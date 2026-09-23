import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://nomadamas.github.io/",
    title: "NomaDamas",
    description:
      "서울의 AI 오픈소스 해커하우스. 없어서 만든 것들을 전부 공개합니다.",
    author: "NomaDamas",
    profile: "https://github.com/NomaDamas",
    ogImage: "default-og.jpg",
    lang: "ko",
    timezone: "Asia/Seoul",
    dir: "ltr",
  },
  posts: {
    perPage: 8,
    perIndex: 5,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    // 저장소가 공개라 독자가 오타를 바로 고쳐 PR을 보낼 수 있다.
    editPost: {
      enabled: true,
      url: "https://github.com/NomaDamas/nomadamas.github.io/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    { name: "github", url: "https://github.com/NomaDamas" },
    { name: "x", url: "https://x.com/n0madamas" },
    { name: "linkedin", url: "https://www.linkedin.com/showcase/nomadamas/" },
  ],
  shareLinks: [
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "linkedin", url: "https://www.linkedin.com/sharing/share-offsite/?url=" },
    { name: "mail", url: "mailto:?subject=이 글 보세요&body=" },
  ],
});
