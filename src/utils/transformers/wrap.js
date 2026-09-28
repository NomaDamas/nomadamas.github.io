/**
 * 코드 블록 메타에 `wrap`이 있으면 <pre>에 `wrap` 클래스를 붙인다.
 * 독자가 복사해 쓰는 긴 문장처럼 가로 스크롤보다 줄바꿈이 나은 블록에만 쓴다.
 * 예: ```text wrap
 * 스타일은 global.css의 pre.astro-code.wrap. 메타를 읽는 방식은 fileName.js와 같다.
 */
export const transformerWrap = () => ({
  pre(node) {
    const meta = this.options.meta?.__raw?.split(" ") ?? [];
    if (meta.includes("wrap")) this.addClassToHast(node, "wrap");
  },
});
