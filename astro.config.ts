import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { postLastmod } from "./src/utils/postLastmod";
import config from "./astro-paper.config";

const lastmod = postLastmod(config.site.url);

export default defineConfig({
  site: config.site.url,
  // layout을 설정해야 srcset이 생긴다. 기본값이면 원본 해상도 1장만 내려간다.
  // 기본 breakpoints는 8단계라 이미지 1장이 8개 파일이 된다. 본문 폭에 맞춰 줄인다.
  image: {
    layout: "constrained",
    breakpoints: [640, 960, 1280, 1920],
  },
  integrations: [
    mdx(),
    sitemap({
      // sitemap에는 색인될 페이지만 넣는다. 검색 페이지는 noindex라 뺀다.
      filter: page =>
        !page.endsWith("/search/") &&
        (config.features?.showArchives !== false ||
          !page.endsWith("/archives/")),
      // 날짜를 아는 페이지(글, 글 목록)에만 lastmod를 단다. 모르는 곳에 빌드 시각을 넣으면
      // 매번 전부 바뀐 것처럼 보여 구글이 lastmod를 무시하게 된다.
      serialize: item => {
        const date = lastmod.get(item.url);
        return date ? { ...item, lastmod: date } : item;
      },
    }),
  ],
  i18n: {
    locales: ["ko"],
    defaultLocale: "ko",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
      ],
      rehypePlugins: [rehypeCallouts],
    }),
    shikiConfig: {
      // night-owl은 배경이 #011627 남색이라 무채색 팔레트와 안 맞는다.
      // min-dark 배경 #1f1f1f는 --muted와 같은 값이고 min-light와 같은 계열이다.
      themes: { light: "min-light", dark: "min-dark" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      name: "Google Sans Code",
      cssVariable: "--font-google-sans-code",
      provider: fontProviders.google(),
      fallbacks: ["monospace"],
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
      formats: ["woff", "ttf"],
    },
    {
      // OG 이미지용 한글 폰트. Layout의 <Font>가 참조하지 않으므로 방문자에게 preload되지 않고,
      // 빌드 때 satori가 experimental_getFontFileURL로만 가져간다.
      name: "Nanum Gothic Coding",
      cssVariable: "--font-nanum-gothic-coding",
      provider: fontProviders.google(),
      fallbacks: ["monospace"],
      weights: [400, 700],
      styles: ["normal"],
      // satori는 ttf만 읽는다. woff까지 받으면 아무도 안 쓰는 1.6MB가 배포된다.
      formats: ["ttf"],
    },
  ],
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      // 아래 넷은 src/components/SiteAnalytics.astro가 쓴다. CI에서는 저장소 변수(vars.*)로 들어온다.
      PUBLIC_NAVER_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      PUBLIC_BING_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      PUBLIC_GA_MEASUREMENT_ID: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      PUBLIC_CLARITY_PROJECT_ID: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
