import type { APIRoute } from "astro";
import { getCollection, getEntry } from "astro:content";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import config from "@/config";

// llms.txt의 짝. 소개와 모든 글 본문을 마크다운 한 파일로 묶어, 에이전트가 페이지를
// 하나씩 긁지 않고 한 번에 읽게 한다. 글 원문(.md)에서 빌드 때 만들어진다.
// 이미지 경로(@/assets/...)는 사이트 밖에서 의미가 없어 대체 텍스트만 남긴다.
const stripImages = (md: string) =>
  md.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) =>
    alt ? `(이미지: ${alt})` : ""
  );

export const GET: APIRoute = async () => {
  const posts = getSortedPosts(await getCollection("posts"));
  const about = await getEntry("pages", "about");
  const abs = (path: string) => new URL(path, config.site.url).href;
  const day = (d: Date) => d.toISOString().slice(0, 10);

  const sections = posts.map(({ data, id, filePath, body }) =>
    [
      `## ${data.title}`,
      "",
      `- URL: ${abs(getPostUrl(id, filePath))}`,
      `- 발행: ${day(data.pubDatetime)}`,
      ...(data.modDatetime ? [`- 수정: ${day(data.modDatetime)}`] : []),
      `- 요약: ${data.description}`,
      "",
      stripImages(body ?? "").trim(),
    ].join("\n")
  );

  const text = [
    `# ${config.site.title}`,
    "",
    `> ${config.site.description}`,
    "",
    ...(about?.body ? [stripImages(about.body).trim(), ""] : []),
    ...sections.flatMap(s => ["---", "", s, ""]),
  ].join("\n");

  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
