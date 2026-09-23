// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.nomadamas.org',
	trailingSlash: 'always',
	// GitHub Pages는 경로별 301을 못 만든다. URL 구조는 첫 배포 전에 확정한다.
	image: {
		// layout을 설정해야 srcset이 생긴다. 기본값(undefined)이면 원본 1장만 내려간다.
		layout: 'constrained',
		// 기본 breakpoints는 8단계라 이미지 1장이 8개 파일이 된다. 본문 폭 720px 기준으로 줄인다.
		breakpoints: [640, 960, 1280, 1920],
	},
	integrations: [mdx(), sitemap()],
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
