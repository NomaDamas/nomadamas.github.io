import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import config from "@/config";

// llmstxt.org 형식. 구글 검색은 이 파일을 쓰지 않지만(Search Central 2026-06-15),
// 코딩 에이전트가 읽어 가고 Lighthouse 에이전트 브라우징 점검이 검사한다.
// 글 목록에서 빌드 때 만들어지므로 손으로 고칠 일이 없다.
export const GET: APIRoute = async () => {
	const posts = getSortedPosts(await getCollection("posts"));
	const abs = (path: string) => new URL(path, config.site.url).href;

	const postLines = posts.map(
		({ data, id, filePath }) =>
			`- [${data.title}](${abs(getPostUrl(id, filePath))}): ${data.description}`,
	);

	const body = [
		`# ${config.site.title}`,
		"",
		`> ${config.site.description}`,
		"",
		"NomaDamas는 Markr가 운영하는 서울의 AI 오픈소스 해커하우스입니다.",
		`만든 프로젝트는 [GitHub](${config.site.profile})에 공개하고, 이 블로그에는 만들면서 알게 된 걸 적습니다.`,
		"",
		"## 글",
		"",
		...postLines,
		"",
		"## Optional",
		"",
		`- [소개](${abs("about/")}): NomaDamas가 어떤 곳인지`,
		`- [RSS](${abs("rss.xml")}): 새 글 피드`,
		"",
	].join("\n");

	return new Response(body, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};
