import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { AstroIntegration } from "astro";
import { isTocHeading, TOC_MAX_DEPTH, TOC_MIN_DEPTH } from "./toc";

// 빌드는 통과하는데 발행된 글이 조용히 깨지는 경우를 빌드 시작 전에 잡아 빌드를 멈춘다.
// 로컬 pnpm build, PR 검사(check.yml), 배포(deploy.yml)가 모두 astro build를 거치므로 셋 다 걸린다.
// 웹 편집기처럼 PR 없이 main에 바로 올린 글은 배포 빌드에서 걸리고, 사이트는 이전 배포에 머문다.
// 규칙의 이유는 AGENTS.md의 "발행", "본문 관례", "이미지" 절에 있다. 초안(draft: true)은 발행되지 않아 보지 않는다.

export type Problem = { file: string; line?: number; message: string };

export type CheckOptions = {
  /** postFilter.ts가 쓰는 예약 여유 시간. 발행 시각이 지금보다 이만큼 넘게 미래인 글은 빌드에서 빠진다 */
  scheduledPostMargin: number;
  /** 기준 시각. 기본값은 지금 */
  now?: number;
  /** 글 폴더. content.config.ts의 BLOG_PATH와 같다 */
  postsDir?: string;
  /** GIF 파일을 찾을 폴더 */
  assetDirs?: string[];
};

// 시간대까지 적은 ISO 시각. 시간대를 빼면 YAML이 UTC로 읽어 한국 시각으로 9시간 늦게 발행된다
const DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

// 프런트매터 한 줄의 값과 그 줄 번호. 따옴표와 줄 끝 주석은 걷는다
function field(front: string[], key: string) {
  const index = front.findIndex(line => line.startsWith(`${key}:`));
  if (index < 0) return undefined;
  const value = front[index]
    .slice(key.length + 1)
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2");
  // 파일 첫 줄이 ---라서 프런트매터의 0번 줄이 파일의 2번째 줄이다
  return { value, line: index + 2 };
}

function checkDates(
  file: string,
  front: string[],
  now: number,
  margin: number
): Problem[] {
  const problems: Problem[] = [];
  for (const key of ["pubDatetime", "modDatetime"]) {
    const date = field(front, key);
    if (!date || ["", "null", "~"].includes(date.value)) continue;
    if (!DATETIME.test(date.value)) {
      problems.push({
        file,
        line: date.line,
        message:
          `${key}(${date.value})에 시각과 시간대까지 적는다. 예: 2026-09-23T18:00:00+09:00. ` +
          "시간대를 빼면 UTC로 읽혀 한국 시각으로 9시간 늦게 발행된다",
      });
    }
  }

  // postFilter.ts와 같은 조건이다. 여기에 걸리는 글은 목록과 페이지에서 빠진다
  const pub = field(front, "pubDatetime");
  if (
    pub &&
    DATETIME.test(pub.value) &&
    Date.parse(pub.value) - margin >= now
  ) {
    problems.push({
      file,
      line: pub.line,
      message:
        `pubDatetime(${pub.value})이 빌드 시각보다 미래다. 이대로면 이 글이 빠진 채 배포되고, ` +
        "정해진 시각에 다시 빌드하는 장치가 없어서 그 시각이 지나도 다음 배포 전까지 안 보인다. 발행하는 시각으로 고친다",
    });
  }
  return problems;
}

type Heading = { index: number; depth: number; text: string };

// mdast-util-to-string처럼 제목에서 서식을 걷고 글자만 남긴다. 이미지 대체 텍스트는 뺀다
const plain = (text: string) =>
  text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .trim();

// 인라인 코드 안의 <details>나 이미지 문법은 예시일 뿐이라 걷고 본다
const stripInlineCode = (line: string) => line.replace(/(`+).*?\1/g, "");

// 본문의 이미지 주소. 마크다운 ![](주소)와 HTML <img src>
const imageSources = (text: string) => [
  ...[...text.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g)].map(m => m[1]),
  ...[...text.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)].map(
    m => m[1]
  ),
];

// remark-toc(mdast-util-toc)는 최상위 목차 제목부터 같은 깊이 이하의 다음 제목 전까지를 목차 목록으로
// 바꾼다. 그 뒤에 목차에 넣을 깊이의 제목이 없으면 아무것도 바꾸지 않는다. 같은 조건으로 지워질 줄을 찾는다
function tocProblem(
  file: string,
  lines: string[],
  headings: Heading[]
): Problem | undefined {
  const at = headings.findIndex(h => isTocHeading(h.text));
  if (at < 0) return undefined;
  const toc = headings[at];
  const endAt = headings.findIndex((h, i) => i > at && h.depth <= toc.depth);
  if (endAt < 0) return undefined;
  const listed = headings
    .slice(endAt)
    .some(h => h.depth >= TOC_MIN_DEPTH && h.depth <= TOC_MAX_DEPTH);
  if (!listed) return undefined;

  for (let i = toc.index + 1; i < headings[endAt].index; i++) {
    const line = lines[i].trim();
    if (line && !/^<!--.*-->$/.test(line)) {
      return {
        file,
        line: i + 1,
        message:
          `"${lines[toc.index].trim()}"부터 다음 제목 전까지는 목차 목록으로 바뀌며 지워진다. ` +
          "이 줄부터의 내용을 목차 뒤 절로 옮긴다",
      };
    }
  }
  return undefined;
}

function checkBody(file: string, lines: string[], start: number): Problem[] {
  const problems: Problem[] = [];
  const headings: Heading[] = [];
  // 열려 있는 코드 블록의 울타리(``` 또는 ~~~). 코드 블록 안은 예시라 보지 않는다
  let fence: string | undefined;

  for (let i = start; i < lines.length; i++) {
    // 콜아웃(> [!faq]-) 안의 코드 블록과 이미지도 보도록 인용 표시를 걷는다
    const unquoted = lines[i].replace(/^( {0,3}>[ \t]?)+/, "");
    const marker = unquoted.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
    if (fence) {
      const closes =
        marker?.[0] === fence[0] &&
        marker.length >= fence.length &&
        unquoted.trim() === marker;
      if (closes) fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }

    // 목차는 최상위 제목만 본다. 인용 안의 제목은 remark-toc도 보지 않는다
    const heading = lines[i].match(
      /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
    );
    if (heading) {
      headings.push({
        index: i,
        depth: heading[1].length,
        text: plain(heading[2] ?? ""),
      });
    }

    const text = stripInlineCode(unquoted);
    const at = { file, line: i + 1 };
    if (/<details\b/i.test(text)) {
      problems.push({
        ...at,
        message:
          "raw <details>는 테마 CSS(typography.css)가 안의 문단을 숨긴다. " +
          '접는 내용은 "> [!faq]- 질문" 콜아웃으로 쓴다',
      });
    }
    for (const src of imageSources(text)) {
      if (/^\/(?!\/)/.test(src)) {
        problems.push({
          ...at,
          message:
            `이미지 ${src}가 public/을 가리킨다. Astro가 최적화하지 않아 원본이 그대로 나간다. ` +
            "src/assets/images/에 두고 @/assets/images/로 참조한다",
        });
      }
      if (!/^https?:/i.test(src) && /\.gif$/i.test(src.split(/[?#]/)[0])) {
        problems.push({
          ...at,
          message: `GIF(${src})를 쓰지 않는다. mp4로 만들어 public/videos/에 둔다`,
        });
      }
    }
  }

  const toc = tocProblem(file, lines, headings);
  if (toc) problems.push(toc);
  return problems;
}

const listFiles = (dir: string) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" }).map(f =>
    join(dir, f)
  );

export function findProblems(options: CheckOptions) {
  const {
    scheduledPostMargin,
    now = Date.now(),
    postsDir = "src/content/posts",
    assetDirs = ["src/assets", "public"],
  } = options;
  const problems: Problem[] = [];
  let checked = 0;

  // content.config.ts의 glob("**/[^_]*.{md,mdx}")과 같은 글을 본다
  const posts = listFiles(postsDir)
    .filter(f => /\.mdx?$/.test(f) && !basename(f).startsWith("_"))
    .sort();
  for (const file of posts) {
    const lines = readFileSync(file, "utf-8").split(/\r?\n/);
    const end = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
    const front = end > 0 ? lines.slice(1, end) : [];
    if (field(front, "draft")?.value === "true") continue;

    checked++;
    problems.push(
      ...checkDates(file, front, now, scheduledPostMargin),
      ...checkBody(file, lines, end + 1)
    );
  }

  for (const file of assetDirs
    .filter(dir => existsSync(dir))
    .flatMap(listFiles)) {
    if (/\.gif$/i.test(file)) {
      problems.push({
        file,
        message:
          "GIF 파일을 커밋하지 않는다. mp4로 만들어 public/videos/에 둔다",
      });
    }
  }
  return { problems, checked };
}

/** 빌드 시작 전에 모든 글을 검사한다. 하나라도 걸리면 빌드를 멈춘다 */
export default function checkPosts(options: CheckOptions): AstroIntegration {
  return {
    name: "check-posts",
    hooks: {
      "astro:build:start": ({ logger }) => {
        const { problems, checked } = findProblems(options);
        if (problems.length > 0) {
          problems.sort(
            (a, b) =>
              a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0)
          );
          const error = new Error(
            [
              `글 검사에서 ${problems.length}건이 걸렸습니다. 이유는 AGENTS.md의 "발행", "본문 관례", "이미지" 절에 있습니다.`,
              ...problems.map(
                p => `- ${p.file}${p.line ? `:${p.line}` : ""} ${p.message}`
              ),
            ].join("\n")
          );
          // 위치를 주지 않으면 Astro가 메시지 속 괄호(예: 발행 시각)를 파일 위치로 잘못 읽는다.
          // 첫 문제의 줄을 주면 그 줄 주변 코드를 함께 보여 준다
          const first = problems.find(p => p.line);
          throw Object.assign(
            error,
            first && {
              loc: { file: resolve(first.file), line: first.line, column: 1 },
            }
          );
        }
        logger.info(`글 ${checked}편 검사 통과`);
      },
    },
  };
}
