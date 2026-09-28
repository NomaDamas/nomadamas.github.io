// "## 목차" 제목과 remark-toc가 그 아래에 만든 링크 목록을 테두리 상자(<nav class="toc">)로 바꾼다.
// 목차가 늘 펼쳐져 있고 "목차"라는 말이 한 번만 나오게 하려는 것이다. 스타일은 global.css의 nav.toc.
// 영어 "Table of contents"는 테마 기본 동작(remark-collapse로 접기)을 그대로 쓴다.
// astro.config.ts에서 remark-toc 다음, remark-collapse 앞에 둔다.
type Node = { type: string; depth?: number; value?: string; children?: Node[] };

const text = (n: Node): string =>
  n.value ?? (n.children ?? []).map(text).join("");

export default function remarkTocBox() {
  return (tree: Node) => {
    const kids = tree.children ?? [];
    const i = kids.findIndex(
      n => n.type === "heading" && n.depth === 2 && text(n).trim() === "목차"
    );
    if (i < 0 || kids[i + 1]?.type !== "list") return;
    kids.splice(i, 1, {
      type: "html",
      value: '<nav class="toc" aria-label="목차"><strong>목차</strong>',
    });
    kids.splice(i + 2, 0, { type: "html", value: "</nav>" });
  };
}
