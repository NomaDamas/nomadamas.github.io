// 글 목차 설정. remark-toc(astro.config.ts), 목차 상자(remarkTocBox.ts),
// 떠 있는 목차(pages/posts/[...slug]/index.astro)가 같은 값을 쓰도록 한곳에 둔다.

// 목차 자리로 알아보는 제목. remark-toc 기본값 "(table[ -]of[ -])?contents?|toc" 앞에 "목차"만 더했다
export const TOC_HEADING = "목차|(table[ -]of[ -])?contents?|toc";

// 목차에 넣는 제목 깊이. 절(h2)과 소절(h3)만 넣는다. 글 제목(h1)은 본문 밖에 있다
export const TOC_MIN_DEPTH = 2;
export const TOC_MAX_DEPTH = 3;

// 제목이 이보다 적은 짧은 글에는 떠 있는 목차를 띄우지 않는다
export const FLOATING_TOC_MIN_HEADINGS = 3;

// remark-toc(mdast-util-toc)와 같은 방식으로 제목 전체를 대소문자 구분 없이 비교한다.
// remarkTocBox가 목차 자리를 찾을 때 쓴다
const tocHeadingRe = new RegExp(`^(${TOC_HEADING})$`, "i");
export const isTocHeading = (text: string) => tocHeadingRe.test(text.trim());
