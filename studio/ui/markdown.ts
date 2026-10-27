// 브리프, 근거 표, AI 점검 결과를 보여 줄 만큼의 마크다운 변환.
// 에이전트가 쓴 파일이라 HTML을 그대로 넣지 않는다. 모든 글자를 먼저 이스케이프하고
// 아래 규칙으로 정한 태그만 만든다. 링크는 http(s)만 건다.

function escape(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text: string) {
  let out = escape(text);
  const codes: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
    );
  return out.replace(
    /\u0000(\d+)\u0000/g,
    (_, n: string) => codes[Number(n)] ?? ""
  );
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (/^```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i] ?? ""))
        body.push(lines[i++] ?? "");
      i++;
      html.push(`<pre><code>${escape(body.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(4, (heading[1]?.length ?? 1) + 1);
      html.push(`<h${level}>${inline(heading[2] ?? "")}</h${level}>`);
      i++;
      continue;
    }
    if (/^\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i] ?? "")) {
        const row = lines[i] ?? "";
        if (!/^\|\s*:?-{2,}/.test(row))
          rows.push(
            row
              .replace(/^\||\|\s*$/g, "")
              .split("|")
              .map(c => c.trim())
          );
        i++;
      }
      const [head = [], ...body] = rows;
      html.push(
        `<div class="md-table"><table><thead><tr>${head
          .map(c => `<th>${inline(c)}</th>`)
          .join("")}</tr></thead><tbody>${body
          .map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i] ?? "")) {
        const raw = lines[i] ?? "";
        const depth = Math.floor((/^\s*/.exec(raw)?.[0].length ?? 0) / 2);
        const text = raw.replace(/^\s*([-*]|\d+\.)\s+/, "");
        items.push(
          `<li style="margin-left:${depth * 1.2}em">${inline(text)}</li>`
        );
        i++;
      }
      html.push(
        ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        quote.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i++;
      }
      html.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^(#{1,4}\s|```|\||\s*([-*]|\d+\.)\s|>)/.test(lines[i] ?? "")
    ) {
      paragraph.push(lines[i++] ?? "");
    }
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }
  return html.join("\n");
}
