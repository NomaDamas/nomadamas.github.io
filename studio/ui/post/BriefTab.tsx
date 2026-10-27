import { useRef, useState } from "react";
import { ErrorNote, Markdown } from "../components.tsx";
import { send, timeAgo, useAction, type Detail } from "../lib.ts";

export function BriefTab({
  detail,
  refresh,
}: {
  detail: Detail;
  refresh: () => void;
}) {
  const { record, facts } = detail;
  const base = `/api/posts/${encodeURIComponent(record.id)}`;
  const action = useAction();
  const briefRef = useRef<HTMLDivElement>(null);
  const [quote, setQuote] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const briefComments = detail.comments.filter(c => c.anchor.kind === "brief");

  function captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !briefRef.current) return;
    if (!briefRef.current.contains(selection.anchorNode)) return;
    setQuote(selection.toString().trim().slice(0, 300));
  }

  async function approve() {
    setNotice(null);
    await action.run("approve", async () => {
      const result = await send<{ delivered: boolean; reason: string | null }>(
        `${base}/brief/approve`,
        {
          sha256: facts.brief.sha256,
        }
      );
      setNotice(
        result.delivered
          ? "승인했습니다. 에이전트에게 다음 단계로 넘어가라고 보냈습니다."
          : `승인했습니다. 에이전트에게는 보내지 못했습니다: ${result.reason}`
      );
    });
    refresh();
  }

  async function comment() {
    const ok = await action.run("comment", () =>
      send(`${base}/comments`, { anchor: { kind: "brief", quote }, body })
    );
    if (ok) {
      setBody("");
      setQuote("");
      refresh();
    }
  }

  return (
    <div className="two-col">
      <div className="stack">
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3>{record.mode === "fix" ? "고칠 것" : "요청"}</h3>
            <span className="small faint mono">request.md</span>
          </div>
          {facts.request ? (
            <Markdown source={facts.request} />
          ) : (
            <div className="muted">요청서가 없습니다.</div>
          )}
        </div>
        {detail.claims && (
          <div className="card stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3>근거 표</h3>
              <span className="small faint mono">claims.md</span>
            </div>
            <Markdown source={detail.claims} />
          </div>
        )}
        {facts.captures > 0 && (
          <div className="muted small">
            캡처 원본 {facts.captures}개가 작업 폴더 captures/에 있습니다.
          </div>
        )}
        <div className="small faint mono" style={{ overflowWrap: "anywhere" }}>
          작업 폴더 {record.workDir}
        </div>
      </div>

      <div className="stack">
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3>브리프</h3>
            {facts.brief.sha256 && (
              <span className="small faint mono">
                brief.md · {facts.brief.sha256.slice(0, 8)}
              </span>
            )}
          </div>
          {facts.brief.text === null ? (
            <div className="muted">
              {record.mode === "fix"
                ? "고치기에는 브리프가 없어도 됩니다. 원고 탭에서 코멘트를 남기세요."
                : record.agent
                  ? "에이전트가 브리프를 쓰는 중입니다. 다 쓰면 여기 나타납니다."
                  : "에이전트를 띄우면 브리프부터 씁니다."}
            </div>
          ) : (
            <>
              <div ref={briefRef} onMouseUp={captureSelection}>
                <Markdown source={facts.brief.text} />
              </div>
              {facts.brief.approved ? (
                <div className="notice ok">
                  승인함 ·{" "}
                  {record.briefApproval
                    ? timeAgo(record.briefApproval.approvedAt)
                    : ""}
                  . 승인한 뒤 브리프가 바뀌면 다시 승인을 받습니다.
                </div>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  {facts.brief.changedAfterApproval && (
                    <div className="notice warn">
                      승인한 뒤 에이전트가 브리프를 고쳤습니다. 바뀐 내용을 읽고
                      다시 승인하세요.
                    </div>
                  )}
                  <div className="row">
                    <button
                      className="btn primary"
                      disabled={action.busy !== null}
                      onClick={approve}
                    >
                      이 브리프로 진행
                    </button>
                    <span className="small muted">
                      고칠 곳이 있으면 아래에 코멘트를 남기세요. 승인 전에는
                      원고를 쓰지 않습니다.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {facts.brief.text !== null && (
          <div className="card stack">
            <h3>브리프에 코멘트</h3>
            {quote && (
              <div className="row" style={{ alignItems: "flex-start" }}>
                <div className="quote" style={{ flex: 1 }}>
                  {quote}
                </div>
                <button
                  className="btn ghost small"
                  onClick={() => setQuote("")}
                >
                  빼기
                </button>
              </div>
            )}
            {!quote && (
              <div className="small muted">
                브리프에서 문장을 고르면 그 자리에 코멘트를 답니다.
              </div>
            )}
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="예: 독자를 비개발자로 바꿔 주세요"
            />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                className="btn primary small"
                disabled={!body.trim() || action.busy !== null}
                onClick={comment}
              >
                코멘트 남기기
              </button>
            </div>
            {briefComments.map(c => (
              <div
                key={c.id}
                className={`comment ${c.status === "resolved" ? "resolved" : ""}`}
                style={{ cursor: "default" }}
              >
                {c.anchor.kind === "brief" && c.anchor.quote && (
                  <div className="quote">{c.anchor.quote}</div>
                )}
                <div>{c.body}</div>
                {c.replies.map((r, i) => (
                  <div key={i} className="reply">
                    <b>{r.author === "agent" ? "에이전트" : "나"}</b> {r.body}
                  </div>
                ))}
                <div className="small faint">
                  {c.id} ·{" "}
                  {c.delivery === "sent"
                    ? "에이전트에게 보냄"
                    : c.delivery === "failed"
                      ? `보내지 못함: ${c.deliveryError ?? ""}`
                      : c.delivery === "pending"
                        ? "보내는 중"
                        : "에이전트 없음"}
                </div>
              </div>
            ))}
          </div>
        )}
        {notice && <div className="notice ok">{notice}</div>}
        <ErrorNote error={action.error} />
      </div>
    </div>
  );
}
