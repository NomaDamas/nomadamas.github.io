import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

// 네이버 서치어드바이저는 RSS에 본문 전체를 요구한다. content를 비우면 수집이 약해진다.
const bodies = import.meta.glob('../content/blog/**/*.{md,mdx}', { query: '?raw', import: 'default', eager: true });

export async function GET(context) {
	const posts = (await getCollection('blog')).sort((a, b) => b.data.pubDate - a.data.pubDate);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		customData: '<language>ko</language>',
		items: posts.map((post) => ({
			...post.data,
			link: `/posts/${post.id}/`,
			content: post.body,
		})),
	});
}
