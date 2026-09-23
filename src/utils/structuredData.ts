import config from "@/config";

// JSON-LD 공통 조각. 글은 조직 명의로 쓰므로 author와 publisher가 같은 Organization이다.
// 값은 전부 화면에 보이는 정보에서만 가져온다(schema.org 가이드: 페이지에 없는 내용을 마크업하지 않는다).

const { site, socials } = config;

export const organizationId = new URL("#organization", site.url).href;

export function organization() {
  return {
    "@type": "Organization",
    "@id": organizationId,
    name: site.title,
    url: site.url,
    description: site.description,
    // 구글 로고 요건은 112px 이상, 크롤링 가능한 URL. public/의 180px 흰 배경 아이콘을 쓴다.
    logo: {
      "@type": "ImageObject",
      url: new URL("apple-touch-icon.png", site.url).href,
      width: 180,
      height: 180,
    },
    sameAs: socials.map(({ url }) => url),
  };
}

export function website() {
  return {
    "@type": "WebSite",
    "@id": new URL("#website", site.url).href,
    name: site.title,
    url: site.url,
    description: site.description,
    inLanguage: site.lang,
    publisher: { "@id": organizationId },
  };
}

/** 글쓴이가 사이트 기본값(조직)이면 Organization, 아니면 이름만 있는 Person. */
export function author(name: string) {
  return name === site.author
    ? { "@type": "Organization", "@id": organizationId, name, url: site.url }
    : { "@type": "Person", name };
}
