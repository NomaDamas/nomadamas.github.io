import type { UIStrings } from "../types";

export default {
  nav: {
    home: "홈",
    posts: "글",
    tags: "태그",
    about: "소개",
    archives: "지난 글",
    search: "검색",
  },
  post: {
    publishedAt: "발행",
    updatedAt: "수정",
    sharePostIntro: "이 글 공유하기",
    sharePostOn: "{{platform}}에 공유하기",
    sharePostViaEmail: "메일로 공유하기",
    tagLabel: "태그",
    backToTop: "맨 위로",
    goBack: "뒤로",
    editPage: "이 글 고치기",
    previousPost: "이전 글",
    nextPost: "다음 글",
  },
  pagination: {
    prev: "이전",
    next: "다음",
    page: "페이지",
  },
  home: {
    socialLinks: "채널",
    featured: "먼저 읽어보세요",
    recentPosts: "최근 글",
    allPosts: "글 전체",
  },
  footer: {
    copyright: "Copyright",
    allRightsReserved: "NomaDamas",
  },
  pages: {
    tagTitle: "태그",
    tagDesc: "이 태그가 붙은 글",

    tagsTitle: "태그",
    tagsDesc: "글에 쓰인 태그를 모았습니다.",

    postsTitle: "글",
    postsDesc: "지금까지 쓴 글을 모았습니다.",

    archivesTitle: "지난 글",
    archivesDesc: "날짜별로 모아 봅니다.",

    searchTitle: "검색",
    searchDesc: "찾는 글이 있으신가요",
  },
  a11y: {
    skipToContent: "본문으로 건너뛰기",
    openMenu: "메뉴 열기",
    closeMenu: "메뉴 닫기",
    toggleTheme: "밝게 어둡게 바꾸기",
    searchPlaceholder: "글 검색...",
    noResults: "찾는 글이 없습니다",
    goToPreviousPage: "이전 페이지로",
    goToNextPage: "다음 페이지로",
  },
  notFound: {
    title: "404 Not Found",
    message: "없는 페이지입니다",
    goHome: "홈으로 돌아가기",
  },
} satisfies UIStrings;
