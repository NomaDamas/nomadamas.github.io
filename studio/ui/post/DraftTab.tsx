import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorNote } from "../components.tsx";
import { send, timeAgo, useAction, type Comment, type Detail } from "../lib.ts";

type Anchor = Comment["anchor"];

function anchorLabel(anchor: Anchor) {
  if (anchor.kind === "text") return null;
  if (anchor.kind === "image") return `이미지: ${anchor.alt || anchor.src}`;
  if (anchor.kind === "brief") return "브리프";
  return "글 전체";
}

function deliveryText(comment: Comment) {
  if (comment.delivery === "sent") return "에이전트에게 보냄";
  if (comment.delivery === "pending") return "보내는 중";
  if (comment.delivery === "failed")
    return `보내지 못함: ${comment.deliveryError ?? ""}`;
  return comment.author === "agent"
    ? "에이전트 질문"
    : "에이전트를 띄우면 읽습니다";
}

export function DraftTab({
  detail,
  refresh,
}: {
  detail: Detail;
  refresh: () => void;
}) {
  const { record, preview } = detail;
  const base = `/api/posts/${encodeURIComponent(record.id)}`;
  const frame = useRef<HTMLIFrameElement>(null);
  const action = useAction();
  const [draftAnchor, setDraftAnchor] = useState<Anchor | null>(null);
  const [body, setBody] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [located, setLocated] = useState<string[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [replyTo, setReplyTo] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLDivElement>(null);

  const previewOrigin = preview.url ? new URL(preview.url).origin : null;
  const comments = detail.comments.filter(c => c.anchor.kind !== "brief");
  const questions = comments.filter(
    c => c.author === "agent" && c.status === "open"
  );
  const visible = comments.filter(
    c => c.author === "person" && (showResolved || c.status === "open")
  );
  const textComments = useMemo(
    () =>
      detail.comments
        .filter(c => c.anchor.kind === "text" && c.status === "open")
        .map(c => ({
          id: c.id,
          quote: c.anchor.kind === "text" ? c.anchor.quote : "",
          prefix: c.anchor.kind === "text" ? c.anchor.prefix : "",
          suffix: c.anchor.kind === "text" ? c.anchor.suffix : "",
        })),
    [detail.comments]
  );
  const commentsKey = JSON.stringify(textComments);

  const post = useCallback(
    (message: unknown) => {
      if (previewOrigin)
        frame.current?.contentWindow?.postMessage(message, previewOrigin);
    },
    [previewOrigin]
  );

  // 미리보기에서 오는 메시지. 미리보기 출처에서 온 것만 받는다
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!previewOrigin || event.origin !== previewOrigin || !event.data)
        return;
      const message = event.data as { type: string; [key: string]: unknown };
      if (message.type === "studio:ready") {
        post({
          type: "studio:comments",
          comments: JSON.parse(commentsKey),
          activeId,
        });
        post({ type: "studio:pick-image", on: picking });
      } else if (message.type === "studio:selection") {
        const quote = String(message.quote ?? "");
        if (quote) {
          setDraftAnchor({
            kind: "text",
            quote: quote.slice(0, 500),
            prefix: String(message.prefix ?? ""),
            suffix: String(message.suffix ?? ""),
          });
        }
      } else if (message.type === "studio:image") {
        setDraftAnchor({
          kind: "image",
          src: String(message.src ?? ""),
          alt: String(message.alt ?? ""),
        });
        setPicking(false);
      } else if (message.type === "studio:open") {
        setActiveId(String(message.id));
        setShowResolved(false);
      } else if (message.type === "studio:located") {
        setLocated((message.ids as string[]) ?? []);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewOrigin, post, commentsKey, activeId, picking]);

  useEffect(() => {
    post({
      type: "studio:comments",
      comments: JSON.parse(commentsKey),
      activeId,
    });
  }, [commentsKey, activeId, post]);

  useEffect(() => {
    post({ type: "studio:pick-image", on: picking });
  }, [picking, post]);

  useEffect(() => {
    if (!activeId) return;
    listRef.current
      ?.querySelector(`[data-comment="${activeId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  async function submit() {
    if (!draftAnchor) return;
    const ok = await action.run("comment", () =>
      send(`${base}/comments`, { anchor: draftAnchor, body })
    );
    if (ok) {
      setBody("");
      setDraftAnchor(null);
      refresh();
    }
  }

  async function reply(comment: Comment) {
    const text = replyTo[comment.id] ?? "";
    const ok = await action.run(`reply-${comment.id}`, () =>
      send(`${base}/comments/${comment.id}/reply`, { body: text })
    );
    if (ok) {
      setReplyTo(prev => ({ ...prev, [comment.id]: "" }));
      refresh();
    }
  }

  async function resolve(comment: Comment, resolved: boolean) {
    await action.run(`resolve-${comment.id}`, () =>
      send(`${base}/comments/${comment.id}/resolve`, { resolved })
    );
    refresh();
  }

  async function resend(comment: Comment) {
    await action.run(`resend-${comment.id}`, () =>
      send(`${base}/comments/${comment.id}/resend`)
    );
    refresh();
  }

  const draftExists = detail.facts.draft.exists;

  return (
    <div className="draft-grid">
      <div className="preview-frame">
        {preview.status === "running" && preview.url ? (
          <iframe
            ref={frame}
            src={preview.url}
            title="글 미리보기"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        ) : (
          <div className="preview-empty">
            {!draftExists ? (
              <>
                <h3>원고가 아직 없습니다</h3>
                <div className="muted">
                  {record.mode === "new"
                    ? "브리프를 승인하면 에이전트가 직접 써 본 뒤 원고를 씁니다."
                    : "원고 파일을 찾지 못했습니다."}
                </div>
              </>
            ) : preview.status === "installing" ||
              preview.status === "starting" ? (
              <>
                <h3>
                  {preview.status === "installing"
                    ? "의존성을 설치하는 중"
                    : "미리보기 서버를 띄우는 중"}
                </h3>
                <pre className="log">{preview.log.join("\n") || "…"}</pre>
              </>
            ) : (
              <>
                <h3>미리보기</h3>
                <div className="muted" style={{ maxWidth: 440 }}>
                  글 worktree에서 블로그 개발 서버를 띄워 실제 사이트 모습으로
                  봅니다. 문장을 고르면 그 자리에 코멘트를 답니다.
                </div>
                {preview.status === "error" && (
                  <>
                    <div className="notice error">{preview.error}</div>
                    <pre className="log">{preview.log.join("\n")}</pre>
                  </>
                )}
                <button
                  className="btn primary"
                  disabled={action.busy !== null}
                  onClick={async () => {
                    await action.run("preview", () =>
                      send(`${base}/preview/start`)
                    );
                    refresh();
                  }}
                >
                  미리보기 띄우기
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="sidebar" ref={listRef}>
        <div className="row">
          <button
            className="btn small"
            onClick={() => setDraftAnchor({ kind: "post" })}
          >
            글 전체에 코멘트
          </button>
          <button
            className={`btn small ${picking ? "primary" : ""}`}
            disabled={preview.status !== "running"}
            onClick={() => setPicking(v => !v)}
          >
            {picking ? "이미지를 누르세요" : "이미지 고르기"}
          </button>
          {preview.status === "running" && (
            <>
              <a
                className="btn small ghost"
                href={preview.url ?? "#"}
                target="_blank"
                rel="noreferrer"
              >
                새 창
              </a>
              <button
                className="btn small ghost"
                onClick={async () => {
                  await action.run("stop", () => send(`${base}/preview/stop`));
                  refresh();
                }}
              >
                끄기
              </button>
            </>
          )}
        </div>

        {draftAnchor && (
          <div className="composer">
            {draftAnchor.kind === "text" ? (
              <div className="quote">{draftAnchor.quote}</div>
            ) : (
              <div className="small muted">{anchorLabel(draftAnchor)}</div>
            )}
            <textarea
              autoFocus
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="무엇을 어떻게 고칠지 적습니다. 예: 이 문단은 비개발자에게 너무 어렵습니다. 예시 하나로 바꿔 주세요."
              onKeyDown={event => {
                if (
                  event.key === "Enter" &&
                  (event.metaKey || event.ctrlKey) &&
                  !event.nativeEvent.isComposing
                )
                  submit();
              }}
            />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="small faint">⌘+Enter로 남기기</span>
              <div className="row">
                <button
                  className="btn small"
                  onClick={() => setDraftAnchor(null)}
                >
                  취소
                </button>
                <button
                  className="btn small primary"
                  disabled={!body.trim() || action.busy !== null}
                  onClick={submit}
                >
                  코멘트 남기기
                </button>
              </div>
            </div>
          </div>
        )}

        {questions.map(q => (
          <div
            key={q.id}
            className="comment question"
            data-comment={q.id}
            style={{ cursor: "default" }}
          >
            <div className="small" style={{ fontWeight: 600 }}>
              에이전트 질문 {q.id} · {timeAgo(q.createdAt)}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{q.body}</div>
            {q.replies.map((r, i) => (
              <div key={i} className="reply">
                <b>{r.author === "agent" ? "에이전트" : "나"}</b> {r.body}
              </div>
            ))}
            <textarea
              value={replyTo[q.id] ?? ""}
              onChange={e =>
                setReplyTo(prev => ({ ...prev, [q.id]: e.target.value }))
              }
              placeholder="답을 적으면 에이전트에게 보냅니다"
              style={{ minHeight: 56 }}
            />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn small" onClick={() => resolve(q, true)}>
                닫기
              </button>
              <button
                className="btn small primary"
                disabled={!(replyTo[q.id] ?? "").trim()}
                onClick={() => reply(q)}
              >
                답하기
              </button>
            </div>
          </div>
        ))}

        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="section-title" style={{ margin: 0 }}>
            코멘트{" "}
            {
              comments.filter(c => c.author === "person" && c.status === "open")
                .length
            }
          </span>
          <label className="small muted row" style={{ gap: 4 }}>
            <input
              type="checkbox"
              checked={showResolved}
              onChange={e => setShowResolved(e.target.checked)}
            />
            닫은 것도 보기
          </label>
        </div>
        {visible.length === 0 && !draftAnchor && (
          <div className="small muted">
            미리보기에서 문장을 고르면 코멘트 창이 열립니다. 남긴 코멘트는
            에이전트 탭으로 바로 전달되고, 에이전트가 고친 곳은 제안 탭에
            덩어리로 쌓입니다.
          </div>
        )}
        {visible.map(c => {
          const lost =
            c.anchor.kind === "text" &&
            located !== null &&
            c.status === "open" &&
            !located.includes(c.id);
          return (
            <div
              key={c.id}
              data-comment={c.id}
              className={`comment ${activeId === c.id ? "active" : ""} ${c.status === "resolved" ? "resolved" : ""}`}
              onClick={() => {
                setActiveId(c.id);
                post({ type: "studio:focus", id: c.id });
              }}
            >
              {c.anchor.kind === "text" ? (
                <div className="quote">{c.anchor.quote}</div>
              ) : (
                <div className="small muted">{anchorLabel(c.anchor)}</div>
              )}
              <div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
              {c.replies.map((r, i) => (
                <div key={i} className="reply">
                  <b>{r.author === "agent" ? "에이전트" : "나"}</b> {r.body}
                </div>
              ))}
              <div
                className="row small faint"
                style={{ justifyContent: "space-between" }}
              >
                <span>
                  {c.id} · {timeAgo(c.createdAt)} · {deliveryText(c)}
                  {lost && " · 본문에서 이 문장이 바뀜"}
                </span>
              </div>
              {activeId === c.id && (
                <div
                  className="stack"
                  style={{ gap: 6 }}
                  onClick={e => e.stopPropagation()}
                >
                  <textarea
                    value={replyTo[c.id] ?? ""}
                    onChange={e =>
                      setReplyTo(prev => ({ ...prev, [c.id]: e.target.value }))
                    }
                    placeholder="덧붙일 말(에이전트에게 다시 보냅니다)"
                    style={{ minHeight: 48 }}
                  />
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    {c.delivery === "failed" && (
                      <button className="btn small" onClick={() => resend(c)}>
                        다시 보내기
                      </button>
                    )}
                    <button
                      className="btn small"
                      onClick={() => resolve(c, c.status === "open")}
                    >
                      {c.status === "open" ? "닫기" : "다시 열기"}
                    </button>
                    <button
                      className="btn small primary"
                      disabled={!(replyTo[c.id] ?? "").trim()}
                      onClick={() => reply(c)}
                    >
                      덧붙이기
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <ErrorNote error={action.error} />
      </div>
    </div>
  );
}
