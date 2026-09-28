// 목차 제목("## 목차", "## Table of contents" 등)과 remark-toc가 그 아래에 만든 링크 목록을
// 테두리 상자(<nav class="toc">)로 바꾼다. 목차가 늘 펼쳐져 있고 제목이 한 번만 나오게 하려는 것이다.
// 상자 머리글은 글쓴이가 적은 제목을 그대로 쓴다. 스타일은 global.css의 nav.toc.
// astro.config.ts에서 remark-toc 다음에 둔다. 목차 제목 패턴은 toc.ts에 있다.
import { isTocHeading } from "./toc";

type Node = { type: string; depth?: number; value?: string; children?: Node[] };

const text = (n: Node): string =>
  n.value ?? (n.children ?? []).map(text).join("");

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!
  );

export default function remarkTocBox() {
  return (tree: Node) => {
    const kids = tree.children ?? [];
    const i = kids.findIndex(
      n => n.type === "heading" && isTocHeading(text(n))
    );
    // remark-toc가 목록을 만들지 못했으면(뒤에 제목이 없는 경우) 제목을 그대로 둔다
    if (i < 0 || kids[i + 1]?.type !== "list") return;
    const label = escapeHtml(text(kids[i]).trim());
    kids.splice(i, 1, {
      type: "html",
      value: `<nav class="toc" aria-label="${label}"><strong>${label}</strong>`,
    });
    kids.splice(i + 2, 0, { type: "html", value: "</nav>" });
  };
}
