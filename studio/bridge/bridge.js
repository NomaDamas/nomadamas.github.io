// 블로그 스튜디오 미리보기 브리지. 스튜디오의 미리보기 프록시가 글 페이지에 끼워 넣는다(server/preview.ts).
// 미리보기는 스튜디오와 다른 포트(다른 출처)라서 postMessage로만 말한다.
// 스튜디오로: 고른 문장, 고른 이미지, 코멘트 위치. 스튜디오에서: 코멘트 목록, 이동할 코멘트.
(() => {
  if (window.__studioBridge || window.parent === window) return;
  window.__studioBridge = true;
  const PARENT = "__STUDIO_ORIGIN__";
  const send = message => window.parent.postMessage(message, PARENT);

  const style = document.createElement("style");
  style.textContent = [
    "astro-dev-toolbar{display:none!important}",
    "::highlight(studio-comment){background:rgb(251 230 160 / 75%)}",
    "::highlight(studio-active){background:rgb(255 196 87)}",
    "html.studio-pick #article img{outline:3px solid rgb(35 131 226);outline-offset:3px;cursor:crosshair}",
  ].join("\n");
  document.head.appendChild(style);

  const article = () => document.getElementById("article") || document.body;

  function textIndex(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = "";
    let node;
    while ((node = walker.nextNode())) {
      nodes.push({ node, start: text.length });
      text += node.data;
    }
    return { nodes, text };
  }

  function offsetOf(index, container, offset) {
    if (container.nodeType === Node.TEXT_NODE) {
      const entry = index.nodes.find(n => n.node === container);
      return entry ? entry.start + offset : -1;
    }
    // 요소 경계에 걸린 선택. 그 자리 다음 글자 노드의 시작으로 본다
    const child = container.childNodes[offset];
    const after = index.nodes.find(
      n =>
        child &&
        (child === n.node ||
          child.compareDocumentPosition(n.node) &
            Node.DOCUMENT_POSITION_FOLLOWING ||
          child.contains(n.node))
    );
    return after ? after.start : index.text.length;
  }

  function rangeAt(index, start, end) {
    const range = document.createRange();
    let started = false;
    for (const { node, start: s } of index.nodes) {
      const e = s + node.data.length;
      if (!started && start >= s && start <= e) {
        range.setStart(node, start - s);
        started = true;
      }
      if (started && end >= s && end <= e) {
        range.setEnd(node, end - s);
        return range;
      }
    }
    return null;
  }

  function sharedTail(a, b) {
    let n = 0;
    while (
      n < a.length &&
      n < b.length &&
      a[a.length - 1 - n] === b[b.length - 1 - n]
    )
      n++;
    return n;
  }
  function sharedHead(a, b) {
    let n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n++;
    return n;
  }

  // 같은 문장이 여러 번 나오면 앞뒤 글자가 가장 많이 겹치는 곳을 고른다
  function locate(index, comment) {
    const quote = comment.quote;
    if (!quote) return null;
    let best = -1;
    let bestScore = -1;
    let at = index.text.indexOf(quote);
    while (at >= 0) {
      const before = index.text.slice(Math.max(0, at - 60), at);
      const after = index.text.slice(at + quote.length, at + quote.length + 60);
      const score =
        sharedTail(before, comment.prefix || "") +
        sharedHead(after, comment.suffix || "");
      if (score > bestScore) {
        best = at;
        bestScore = score;
      }
      at = index.text.indexOf(quote, at + 1);
    }
    return best < 0 ? null : rangeAt(index, best, best + quote.length);
  }

  let comments = [];
  let located = new Map();
  let activeId = null;

  function paint() {
    if (!window.CSS || !CSS.highlights || typeof Highlight === "undefined")
      return;
    const index = textIndex(article());
    located = new Map();
    for (const comment of comments) {
      const range = locate(index, comment);
      if (range) located.set(comment.id, range);
    }
    const open = [...located.entries()]
      .filter(([id]) => id !== activeId)
      .map(([, range]) => range);
    CSS.highlights.set("studio-comment", new Highlight(...open));
    const active = activeId && located.get(activeId);
    if (active) CSS.highlights.set("studio-active", new Highlight(active));
    else CSS.highlights.delete("studio-active");
    send({ type: "studio:located", ids: [...located.keys()] });
  }

  function reportSelection() {
    const selection = window.getSelection();
    const root = article();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      send({ type: "studio:selection", quote: "" });
      return;
    }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    const index = textIndex(root);
    let start = offsetOf(index, range.startContainer, range.startOffset);
    let end = offsetOf(index, range.endContainer, range.endOffset);
    const raw = selection.toString().trim();
    if (start < 0 || end <= start) {
      start = index.text.indexOf(raw);
      end = start + raw.length;
    }
    if (start < 0) return;
    // 앞뒤 공백을 걷어 낸 자리로 맞춘다
    while (start < end && /\s/.test(index.text[start])) start++;
    while (end > start && /\s/.test(index.text[end - 1])) end--;
    const quote = index.text.slice(start, end);
    if (!quote) return;
    send({
      type: "studio:selection",
      quote,
      prefix: index.text.slice(Math.max(0, start - 40), start),
      suffix: index.text.slice(end, end + 40),
    });
  }

  document.addEventListener("mouseup", () => setTimeout(reportSelection, 0));
  document.addEventListener("keyup", event => {
    if (event.shiftKey) reportSelection();
  });

  let picking = false;
  document.addEventListener(
    "click",
    event => {
      const target = event.target;
      const image = target && target.closest && target.closest("#article img");
      if (picking && image) {
        event.preventDefault();
        event.stopPropagation();
        send({
          type: "studio:image",
          src: image.getAttribute("src") || "",
          alt: image.getAttribute("alt") || "",
        });
        return;
      }
      // 강조된 문장을 누르면 그 코멘트를 연다
      if (!located.size || !document.caretRangeFromPoint) return;
      const caret = document.caretRangeFromPoint(event.clientX, event.clientY);
      if (!caret) return;
      for (const [id, range] of located) {
        if (range.comparePoint(caret.startContainer, caret.startOffset) === 0) {
          send({ type: "studio:open", id });
          return;
        }
      }
    },
    true
  );

  window.addEventListener("message", event => {
    if (event.origin !== PARENT || !event.data) return;
    const message = event.data;
    if (message.type === "studio:comments") {
      comments = message.comments || [];
      activeId = message.activeId || null;
      paint();
    } else if (message.type === "studio:focus") {
      activeId = message.id;
      paint();
      const range = located.get(message.id);
      if (range) {
        const rect = range.getBoundingClientRect();
        window.scrollTo({
          top: window.scrollY + rect.top - window.innerHeight / 3,
          behavior: "smooth",
        });
      }
    } else if (message.type === "studio:pick-image") {
      picking = Boolean(message.on);
      document.documentElement.classList.toggle("studio-pick", picking);
    }
  });

  let timer = null;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(paint, 200);
  });
  // ClientRouter가 본문을 갈아 끼운 뒤에도 다시 칠한다
  document.addEventListener("astro:page-load", () => {
    send({ type: "studio:ready", path: location.pathname });
    paint();
  });
  send({ type: "studio:ready", path: location.pathname });
})();
