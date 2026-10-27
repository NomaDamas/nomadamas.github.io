import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ViteDevServer } from "vite";
import { ensureSiteDeps } from "./deps.ts";
import { run, which } from "./exec.ts";
import { draftPath, parseFrontMatter, sha256, POSTS_DIR } from "./posts.ts";
import { writeJsonAtomic, type PostRecord } from "./store.ts";

// 점검은 두 가지다.
// 빠른 점검: 원고 파일만 읽는다. 블로그 빌드가 막는 규칙(src/utils/checkPosts.ts)을 같은 코드로 돌리고,
//   이미지, 제목 구조, 키워드 자리, 근거 표, 지난 교정을 본다. 처음 한 번은 글 worktree에 의존성을 설치한다(deps.ts).
// 빌드 점검: 글 worktree에서 pnpm build를 돌리고 나온 HTML의 메타 태그, 구조화 데이터, llms.txt, sitemap을 읽는다.
// 점수는 내지 않는다. 검색 순위에 대한 점수식은 근거가 약하고, 걸린 곳마다 이유를 적는 쪽이 고치기 쉽다.

export type CheckItem = {
  id: string;
  level: "pass" | "warn" | "fail";
  title: string;
  detail?: string;
  line?: number;
};

export type BuildMeta = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  og: Record<string, string>;
  twitter: Record<string, string>;
  jsonLd: Record<string, unknown>[];
  h1: number;
  lang: string | null;
  inLlmsTxt: boolean;
  inSitemap: boolean;
  ogImageFile: string | null;
};

export type ChecksFile = {
  checkedAt: string;
  draftSha256: string;
  items: CheckItem[];
  build?: {
    at: string;
    ok: boolean;
    log: string[];
    meta: BuildMeta | null;
  };
};

function checksFile(record: PostRecord) {
  return path.join(record.workDir, "checks.json");
}

export function readChecks(record: PostRecord): ChecksFile | null {
  try {
    return JSON.parse(readFileSync(checksFile(record), "utf8")) as ChecksFile;
  } catch {
    return null;
  }
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, "");
}

/** 한글 2바이트를 따지지 않고 글자 수로 센다. 검색 결과 화면은 폭으로 자르므로 대략의 기준이다 */
function length(text: string) {
  return [...text].length;
}

type ProblemsModule = {
  findProblems: (options: {
    scheduledPostMargin: number;
    postsDir?: string;
    assetDirs?: string[];
  }) => { problems: { file: string; line?: number; message: string }[] };
};

async function buildRules(
  vite: ViteDevServer,
  record: PostRecord,
  file: string
): Promise<CheckItem[]> {
  const module = (await vite.ssrLoadModule(
    path.join(record.worktree, "src/utils/checkPosts.ts")
  )) as ProblemsModule;
  const { problems } = module.findProblems({
    scheduledPostMargin: 15 * 60 * 1000,
    postsDir: path.join(record.worktree, POSTS_DIR),
    assetDirs: [
      path.join(record.worktree, "src/assets", "images", record.slug),
    ],
  });
  const mine = problems.filter(
    p => path.resolve(p.file) === file || p.file.includes(record.slug)
  );
  if (mine.length === 0)
    return [
      {
        id: "build-rules",
        level: "pass",
        title: "빌드가 막는 규칙(checkPosts.ts)에 걸리지 않습니다",
      },
    ];
  return mine.map((p, i) => ({
    id: `build-rules-${i}`,
    level: "fail",
    title: "빌드가 멈추는 문제",
    detail: p.message,
    line: p.line,
  }));
}

function correctionsScript(record: PostRecord, agentRoot: string | null) {
  const candidates = [
    agentRoot &&
      path.join(
        agentRoot,
        ".claude/skills/nomadamas-blog/scripts/corrections.py"
      ),
    agentRoot &&
      path.join(
        agentRoot,
        ".agents/skills/nomadamas-blog/scripts/corrections.py"
      ),
  ].filter((p): p is string => Boolean(p));
  return candidates.find(p => existsSync(p)) ?? null;
}

async function correctionItems(
  file: string,
  script: string | null
): Promise<CheckItem[]> {
  if (!script) return [];
  const python = which("python3");
  if (!python) return [];
  const result = await run(python, [script, "check", file], {
    timeoutMs: 60_000,
  });
  const lines = result.stdout.split("\n");
  const items: CheckItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^.+?:(\d+) (C\d+) (.*)$/.exec(lines[i] ?? "");
    if (!match) continue;
    const detail = [match[3]];
    while ((lines[i + 1] ?? "").startsWith("    ")) {
      detail.push((lines[++i] ?? "").trim());
    }
    items.push({
      id: `correction-${match[2]}-${match[1]}`,
      level: "warn",
      title: `지난 교정 ${match[2]}에 걸립니다`,
      detail: detail.join("\n"),
      line: Number(match[1]),
    });
  }
  const summary = lines.filter(Boolean).at(-1) ?? "";
  if (items.length === 0 && summary)
    items.push({ id: "corrections", level: "pass", title: summary });
  return items;
}

export async function quickChecks(
  vite: ViteDevServer,
  record: PostRecord,
  agentRoot: string | null
): Promise<ChecksFile> {
  const file = draftPath(record);
  const items: CheckItem[] = [];
  if (!existsSync(file)) {
    return {
      checkedAt: new Date().toISOString(),
      draftSha256: "",
      items: [
        {
          id: "draft",
          level: "fail",
          title: "원고가 아직 없습니다",
          detail: file,
        },
      ],
    };
  }
  const text = readFileSync(file, "utf8");
  const { front, body, bodyStartLine } = parseFrontMatter(text);
  const bodyLines = body.split("\n");

  if (front.draft === "true") {
    items.push({
      id: "draft-flag",
      level: "warn",
      title: "draft: true라 사이트에 나오지 않습니다",
      detail: "발행하려면 프런트매터의 draft 줄을 지웁니다.",
    });
  }

  // 제목과 설명. 검색 결과와 공유 카드에 그대로 나간다
  const title = front.title ?? "";
  const description = front.description ?? "";
  if (!title)
    items.push({ id: "title", level: "fail", title: "title이 비어 있습니다" });
  else if (length(title) > 40)
    items.push({
      id: "title",
      level: "warn",
      title: `제목이 ${length(title)}자입니다`,
      detail:
        "검색 결과와 공유 카드에서 뒤가 잘릴 수 있습니다. 핵심어를 앞쪽에 둡니다.",
    });
  else
    items.push({
      id: "title",
      level: "pass",
      title: `제목 ${length(title)}자`,
    });
  if (!description)
    items.push({
      id: "description",
      level: "fail",
      title: "description이 비어 있습니다",
      detail: "검색 결과 설명과 공유 카드 설명으로 쓰입니다.",
    });
  else if (length(description) < 40 || length(description) > 160)
    items.push({
      id: "description",
      level: "warn",
      title: `설명이 ${length(description)}자입니다`,
      detail:
        length(description) < 40
          ? "짧으면 구글이 본문에서 아무 문장이나 골라 설명으로 씁니다."
          : "길면 검색 결과에서 잘립니다. 앞 두 문장에 핵심을 둡니다.",
    });
  else
    items.push({
      id: "description",
      level: "pass",
      title: `설명 ${length(description)}자`,
    });

  // 본문 제목 구조. 글 제목(title)이 h1이 되므로 본문은 ##부터 쓴다
  let seenH2 = false;
  bodyLines.forEach((line, index) => {
    if (/^#\s/.test(line))
      items.push({
        id: `h1-${index}`,
        level: "fail",
        title: "본문에 # 제목이 있습니다",
        detail: "글 제목이 h1이 됩니다. 본문 절은 ##부터 씁니다.",
        line: bodyStartLine + index,
      });
    if (/^##\s/.test(line)) seenH2 = true;
    if (/^###\s/.test(line) && !seenH2)
      items.push({
        id: `h3-${index}`,
        level: "warn",
        title: "## 없이 ### 절이 먼저 나옵니다",
        line: bodyStartLine + index,
      });
  });

  // 검색 키워드 자리. 키워드를 정했으면 제목, 설명, 첫 문단, 절 제목 하나에 들어갔는지 본다
  const keyword = record.keyword.trim();
  if (keyword) {
    const key = normalize(keyword);
    const firstParagraph =
      body
        .split(/\n\s*\n/)
        .find(block => block.trim() && !/^\s*(#|!\[|<|>|\||```)/.test(block)) ??
      "";
    const headings = bodyLines.filter(line => /^#{2,3}\s/.test(line));
    const places: [string, boolean][] = [
      ["제목", normalize(title).includes(key)],
      ["설명", normalize(description).includes(key)],
      ["첫 문단", normalize(firstParagraph).includes(key)],
      ["절 제목", headings.some(h => normalize(h).includes(key))],
    ];
    const missing = places.filter(([, ok]) => !ok).map(([name]) => name);
    items.push({
      id: "keyword",
      level: missing.length === 0 ? "pass" : "warn",
      title:
        missing.length === 0
          ? `키워드 "${keyword}"가 제목, 설명, 첫 문단, 절 제목에 있습니다`
          : `키워드 "${keyword}"가 ${missing.join(", ")}에 없습니다`,
      detail:
        missing.length === 0
          ? undefined
          : "검색어와 같은 말이 제목과 첫 문단에 있어야 검색 결과에서 굵게 보이고 독자가 맞는 글인지 알아봅니다. 억지로 반복하지는 않습니다.",
    });
  }

  // 이미지. 대체 텍스트와 파일이 있는지
  const imagePattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let images = 0;
  bodyLines.forEach((line, index) => {
    for (const match of line.matchAll(imagePattern)) {
      images++;
      const [, alt = "", src = ""] = match;
      const lineNo = bodyStartLine + index;
      if (!alt.trim())
        items.push({
          id: `alt-${lineNo}`,
          level: "warn",
          title: "이미지에 대체 텍스트가 없습니다",
          detail: `${src}. 이미지 검색과 화면 낭독기가 이 글로 그림을 설명합니다.`,
          line: lineNo,
        });
      if (/^https?:/.test(src)) continue;
      if (/\.gif$/i.test(src))
        items.push({
          id: `gif-${lineNo}`,
          level: "fail",
          title: "GIF는 쓰지 않습니다",
          detail: "mp4로 만들어 public/videos/에 둡니다(AGENTS.md).",
          line: lineNo,
        });
      const resolved = src.startsWith("@/")
        ? path.join(record.worktree, "src", src.slice(2))
        : src.startsWith("/")
          ? path.join(record.worktree, "public", src)
          : path.resolve(path.dirname(file), src);
      if (src.startsWith("/") && /\.(png|jpe?g|webp|avif)$/i.test(src))
        items.push({
          id: `public-${lineNo}`,
          level: "warn",
          title: "public/의 이미지는 최적화되지 않습니다",
          detail: `${src}. src/assets/images/${record.slug}/에 두고 상대 경로로 겁니다.`,
          line: lineNo,
        });
      if (!existsSync(decodeURI(resolved)))
        items.push({
          id: `missing-${lineNo}`,
          level: "fail",
          title: "이미지 파일이 없습니다",
          detail: src,
          line: lineNo,
        });
    }
  });
  if (images > 0 && !items.some(i => /^(alt|missing|gif)-/.test(i.id)))
    items.push({
      id: "images",
      level: "pass",
      title: `이미지 ${images}장, 대체 텍스트와 파일이 모두 있습니다`,
    });

  // 근거 표. 비어 있는 근거 칸을 센다
  const claimsFile = path.join(record.workDir, "claims.md");
  if (existsSync(claimsFile)) {
    const rows = readFileSync(claimsFile, "utf8")
      .split("\n")
      .filter(line => /^\|/.test(line) && !/^\|\s*-/.test(line))
      .slice(1)
      .map(line =>
        line
          .split("|")
          .slice(1, -1)
          .map(cell => cell.trim())
      );
    const empty = rows.filter(cells => cells.length >= 2 && !cells[1]);
    items.push({
      id: "claims",
      level: empty.length ? "warn" : "pass",
      title: empty.length
        ? `근거 표에 근거가 빈 줄이 ${empty.length}개 있습니다`
        : `근거 표 ${rows.length}줄에 근거가 모두 있습니다`,
    });
  } else if (record.mode === "new") {
    items.push({
      id: "claims",
      level: "warn",
      title: "근거 표(claims.md)가 없습니다",
      detail: "원고의 수치와 단정마다 근거를 남깁니다(스킬 review.md).",
    });
  }

  try {
    const install = await ensureSiteDeps(record.worktree);
    if (!install.ok)
      throw new Error(
        `글 worktree의 pnpm install이 실패했습니다: ${install.log.trim().slice(-500)}`
      );
    items.push(...(await buildRules(vite, record, file)));
  } catch (error) {
    items.push({
      id: "build-rules",
      level: "warn",
      title: "빌드 규칙 검사를 불러오지 못했습니다",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  items.push(
    ...(await correctionItems(file, correctionsScript(record, agentRoot)))
  );

  const previous = readChecks(record);
  const result: ChecksFile = {
    checkedAt: new Date().toISOString(),
    draftSha256: sha256(text),
    items,
    build: previous?.build,
  };
  writeJsonAtomic(checksFile(record), result);
  return result;
}

// ── 빌드 점검 ──────────────────────────────────────────────

const building = new Map<string, { log: string[] }>();

export function buildStatus(id: string) {
  const state = building.get(id);
  return state
    ? { running: true, log: state.log.slice(-30) }
    : { running: false, log: [] };
}

function attr(tag: string, name: string) {
  const match = new RegExp(`${name}\\s*=\\s*"([^"]*)"`).exec(tag);
  return match?.[1] ?? null;
}

function decode(text: string) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function readBuiltMeta(
  record: PostRecord,
  siteUrl: string
): BuildMeta | null {
  const dist = path.join(record.worktree, "dist");
  const page = path.join(dist, "posts", record.slug, "index.html");
  if (!existsSync(page)) return null;
  const html = readFileSync(page, "utf8");
  const head = html.slice(0, html.indexOf("</head>") + 7);
  const metas = [...head.matchAll(/<meta\b[^>]*>/g)].map(m => m[0]);
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  let description: string | null = null;
  for (const tag of metas) {
    const property = attr(tag, "property") ?? attr(tag, "name");
    const content = attr(tag, "content");
    if (!property || content === null) continue;
    if (property.startsWith("og:")) og[property.slice(3)] = decode(content);
    else if (property.startsWith("twitter:"))
      twitter[property.slice(8)] = decode(content);
    else if (property === "description") description = decode(content);
  }
  const jsonLd: Record<string, unknown>[] = [];
  for (const match of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  )) {
    try {
      jsonLd.push(JSON.parse(match[1] ?? "") as Record<string, unknown>);
    } catch {
      // 깨진 JSON-LD는 아래 점검에서 빠진 것으로 보인다
    }
  }
  const postUrl = `${siteUrl}/posts/${record.slug}/`;
  const llms = path.join(dist, "llms.txt");
  const sitemaps = existsSync(dist)
    ? ["sitemap-0.xml", "sitemap-1.xml"]
        .map(name => path.join(dist, name))
        .filter(existsSync)
    : [];
  let ogImageFile: string | null = null;
  if (og.image?.startsWith(siteUrl)) {
    const local = path.join(dist, decodeURI(og.image.slice(siteUrl.length)));
    if (existsSync(local) && statSync(local).isFile()) ogImageFile = local;
  }
  return {
    title: decode(/<title>([^<]*)<\/title>/.exec(head)?.[1] ?? "") || null,
    description,
    canonical: attr(
      /<link[^>]*rel="canonical"[^>]*>/.exec(head)?.[0] ?? "",
      "href"
    ),
    og,
    twitter,
    jsonLd,
    h1: (html.match(/<h1\b/g) ?? []).length,
    lang: attr(/<html\b[^>]*>/.exec(html)?.[0] ?? "", "lang"),
    inLlmsTxt: existsSync(llms) && readFileSync(llms, "utf8").includes(postUrl),
    inSitemap: sitemaps.some(file =>
      readFileSync(file, "utf8").includes(postUrl)
    ),
    ogImageFile,
  };
}

export function metaItems(
  meta: BuildMeta | null,
  siteUrl: string,
  slug: string
): CheckItem[] {
  if (!meta)
    return [
      {
        id: "page",
        level: "fail",
        title: "빌드 결과에 이 글의 페이지가 없습니다",
        detail:
          "draft: true이거나 발행 시각이 너무 먼 미래면 빌드에서 빠집니다.",
      },
    ];
  const items: CheckItem[] = [];
  const postUrl = `${siteUrl}/posts/${slug}/`;
  const posting = meta.jsonLd.find(item => item["@type"] === "BlogPosting");
  // 검색과 공유에 꼭 필요한 것은 fail, 있으면 좋은 것은 warn
  const need: [string, boolean, string, "fail" | "warn"][] = [
    ["<title>", Boolean(meta.title), "검색 결과 제목", "fail"],
    ["meta description", Boolean(meta.description), "검색 결과 설명", "fail"],
    [
      "canonical",
      meta.canonical === postUrl,
      `정본 주소가 ${postUrl}여야 합니다`,
      "fail",
    ],
    [
      "og:title, og:description",
      Boolean(meta.og.title && meta.og.description),
      "공유 카드 글",
      "fail",
    ],
    ["og:image", Boolean(meta.og.image), "공유 카드 그림", "fail"],
    [
      "og:image:alt",
      Boolean(meta.og["image:alt"]),
      "공유 카드 그림 설명. 사이트 레이아웃이 넣는 태그라 글에서 고칠 것은 없습니다",
      "warn",
    ],
    [
      "twitter:card",
      meta.twitter.card === "summary_large_image",
      "X 큰 카드",
      "warn",
    ],
    [
      "BlogPosting 구조화 데이터",
      Boolean(posting?.headline && posting.datePublished),
      "글 제목, 발행일, 작성자",
      "fail",
    ],
    ["h1 하나", meta.h1 === 1, `지금 ${meta.h1}개`, "fail"],
    ["html lang", meta.lang === "ko", `지금 ${meta.lang ?? "없음"}`, "warn"],
    ["llms.txt", meta.inLlmsTxt, "AI 검색이 읽는 글 목록에 들어갔는지", "warn"],
    [
      "sitemap",
      meta.inSitemap,
      "검색엔진에 알리는 주소 목록에 들어갔는지",
      "warn",
    ],
  ];
  for (const [name, ok, why, level] of need) {
    items.push({
      id: `meta-${name}`,
      level: ok ? "pass" : level,
      title: ok ? `${name} 있음` : `${name} 없음`,
      detail: ok ? undefined : why,
    });
  }
  return items;
}

export function startBuild(record: PostRecord, siteUrl: string) {
  if (building.has(record.id)) return;
  const state = { log: [] as string[] };
  building.set(record.id, state);
  void (async () => {
    const install = await ensureSiteDeps(record.worktree);
    state.log.push(...install.log.split("\n"));
    const result = install.ok
      ? await run("pnpm", ["build"], {
          cwd: record.worktree,
          timeoutMs: 10 * 60 * 1000,
        })
      : { code: 1, stdout: "", stderr: "pnpm install이 실패했습니다" };
    state.log.push(...(result.stdout + result.stderr).split("\n"));
    const meta = result.code === 0 ? readBuiltMeta(record, siteUrl) : null;
    const previous = readChecks(record);
    const draftText = existsSync(draftPath(record))
      ? readFileSync(draftPath(record), "utf8")
      : "";
    const next: ChecksFile = {
      checkedAt: previous?.checkedAt ?? new Date().toISOString(),
      draftSha256: previous?.draftSha256 ?? sha256(draftText),
      items: previous?.items ?? [],
      build: {
        at: new Date().toISOString(),
        ok: result.code === 0,
        log: state.log
          .map(line => line.replace(/\x1b\[[0-9;]*m/g, ""))
          .filter(Boolean)
          .slice(-60),
        meta,
      },
    };
    writeJsonAtomic(checksFile(record), next);
    building.delete(record.id);
  })();
}
