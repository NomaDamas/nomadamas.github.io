import { readdirSync, readFileSync } from "node:fs";

// sitemap lastmod용 글별 최종 수정일. astro.config.ts는 콘텐츠 컬렉션을 못 읽어서
// 프런트매터의 pubDatetime, modDatetime 줄만 직접 읽는다. 글 URL 규칙(/posts/<파일명>/)은
// src/utils/getPostPaths.ts와 같아야 한다. 하위 폴더에 둔 글은 건너뛴다(lastmod가 빠질 뿐 무해).
const POSTS_DIR = "src/content/posts";

const field = (src: string, key: string) =>
  src.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, "m"))?.[1];

export function postLastmod(siteUrl: string): Map<string, string> {
  const dates = new Map<string, string>();
  let latest = "";

  for (const file of readdirSync(POSTS_DIR)) {
    if (!/\.mdx?$/.test(file) || file.startsWith("_")) continue;
    const src = readFileSync(`${POSTS_DIR}/${file}`, "utf-8");
    if (/^draft:\s*true\s*$/m.test(src)) continue;

    const raw = field(src, "modDatetime") ?? field(src, "pubDatetime");
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;

    const iso = date.toISOString();
    const slug = file.replace(/\.mdx?$/, "");
    dates.set(new URL(`posts/${slug}/`, siteUrl).href, iso);
    if (iso > latest) latest = iso;
  }

  // 홈과 글 목록은 가장 최근 글이 바뀔 때 함께 바뀐다.
  if (latest) {
    for (const path of ["", "posts/", "archives/"]) {
      dates.set(new URL(path, siteUrl).href, latest);
    }
  }
  return dates;
}
