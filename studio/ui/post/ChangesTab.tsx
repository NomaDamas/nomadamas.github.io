import { useEffect, useState, type ReactNode } from "react";
import { Confirm, ErrorNote } from "../components.tsx";
import { send, useAction, type Detail, type Proposal } from "../lib.ts";

const IMAGE = /\.(png|jpe?g|webp|avif|svg)$/i;

const CHANGE_LABEL = {
  new: "새 파일",
  delete: "지운 파일",
  binary: "바뀐 파일",
  mode: "권한 변경",
} as const;

type Line = Extract<Proposal, { type: "hunk" }>["lines"][number];
type Part = { kind: "same" | "del" | "ins"; text: string };

// 한국어 문장은 줄 전체보다 바뀐 어절이 보여야 읽힌다. 지운 줄과 넣은 줄이 짝을 이루면
// 공백으로 나눈 말 단위로 비교해 한 줄에 지운 말과 넣은 말을 함께 보여 준다
function wordDiff(before: string, after: string): Part[] | null {
  const a = before.match(/\s+|[^\s]+/g) ?? [];
  const b = after.match(/\s+|[^\s]+/g) ?? [];
  if (a.length * b.length > 60000) return null;
  const table = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i]![j] =
        a[i] === b[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  const parts: Part[] = [];
  const push = (kind: Part["kind"], text: string) => {
    const last = parts.at(-1);
    if (last && last.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i++]!);
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) push("del", a[i++]!);
    else push("ins", b[j++]!);
  }
  while (i < a.length) push("del", a[i++]!);
  while (j < b.length) push("ins", b[j++]!);
  return parts;
}

function HunkView({ lines, prose }: { lines: Line[]; prose: boolean }) {
  const rows: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.kind === "-" && prose) {
      const removed: Line[] = [];
      while (lines[i]?.kind === "-") removed.push(lines[i++]!);
      const added: Line[] = [];
      while (lines[i]?.kind === "+") added.push(lines[i++]!);
      const pairs = Math.min(removed.length, added.length);
      for (let k = 0; k < Math.max(removed.length, added.length); k++) {
        const parts =
          k < pairs ? wordDiff(removed[k]!.text, added[k]!.text) : null;
        if (parts) {
          rows.push(
            <div key={`${i}-${k}`} className="mix">
              {parts.map((part, n) =>
                part.kind === "same" ? (
                  <span key={n}>{part.text}</span>
                ) : part.kind === "del" ? (
                  <del key={n}>{part.text}</del>
                ) : (
                  <ins key={n}>{part.text}</ins>
                )
              )}
            </div>
          );
          continue;
        }
        if (k < removed.length)
          rows.push(
            <div key={`${i}-d${k}`} className="del">
              {removed[k]!.text || " "}
            </div>
          );
        if (k < added.length)
          rows.push(
            <div key={`${i}-a${k}`} className="add">
              {added[k]!.text || " "}
            </div>
          );
      }
      continue;
    }
    rows.push(
      <div
        key={i}
        className={
          line.kind === "+" ? "add" : line.kind === "-" ? "del" : "ctx"
        }
      >
        {line.kind === "\\" ? "(파일 끝 줄바꿈 없음)" : line.text || " "}
      </div>
    );
    i++;
  }
  return <pre className={`diff ${prose ? "prose" : ""}`}>{rows}</pre>;
}

export function ChangesTab({
  detail,
  refresh,
}: {
  detail: Detail;
  refresh: () => void;
}) {
  const { record, proposals, staged } = detail;
  const base = `/api/posts/${encodeURIComponent(record.id)}`;
  const action = useAction();
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<"accept" | "reject" | null>(null);

  useEffect(() => {
    if (message) return;
    setMessage(
      record.mode === "fix"
        ? `fix(blog): ${record.slug} 글 수정`
        : `post: ${detail.summary.title} 원고`
    );
  }, [record.mode, record.slug, detail.summary.title, message]);

  async function decide(ids: string[], verdict: "accept" | "reject") {
    await action.run(`${verdict}-${ids.join(",")}`, () =>
      send(`${base}/proposals/decide`, { ids, verdict })
    );
    refresh();
  }

  async function commit() {
    const ok = await action.run("commit", () =>
      send(`${base}/commit`, { message })
    );
    if (ok) refresh();
  }

  const byFile = new Map<string, Proposal[]>();
  for (const p of proposals) {
    byFile.set(p.path, [...(byFile.get(p.path) ?? []), p]);
  }

  return (
    <div
      className="two-col"
      style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)" }}
    >
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h3>에이전트가 고친 곳 {proposals.length}</h3>
            <div className="small muted">
              수락하면 커밋할 변경으로 옮기고, 거절하면 그 덩어리만 되돌립니다.
              거절한 내용은 .studio/rejected/에 남습니다.
            </div>
          </div>
          {proposals.length > 1 && (
            <div className="row">
              <button
                className="btn small"
                onClick={() => setConfirm("reject")}
              >
                모두 거절
              </button>
              <button
                className="btn small primary"
                onClick={() => setConfirm("accept")}
              >
                모두 수락
              </button>
            </div>
          )}
        </div>
        <ErrorNote error={action.error} />
        {proposals.length === 0 && (
          <div className="empty muted">
            {detail.facts.draft.exists
              ? "검토할 제안이 없습니다. 코멘트를 남기면 에이전트가 고친 곳이 여기 쌓입니다."
              : "원고가 생기면 여기서 덩어리별로 수락합니다."}
          </div>
        )}
        {[...byFile.entries()].map(([file, items]) => (
          <div key={file} className="stack" style={{ gap: 8 }}>
            <div className="mono small muted">{file}</div>
            {items.map(p => (
              <div key={p.id} className="hunk">
                <div className="hunk-head">
                  <span className="mono small faint">
                    {p.type === "hunk"
                      ? p.header.replace(/^(@@[^@]+@@).*$/, "$1")
                      : CHANGE_LABEL[p.change]}
                    {p.type === "file" &&
                      p.size !== null &&
                      ` · ${(p.size / 1024).toFixed(1)}KB`}
                  </span>
                  <div className="row">
                    <button
                      className="btn small"
                      disabled={action.busy !== null}
                      onClick={() => decide([p.id], "reject")}
                    >
                      거절
                    </button>
                    <button
                      className="btn small primary"
                      disabled={action.busy !== null}
                      onClick={() => decide([p.id], "accept")}
                    >
                      수락
                    </button>
                  </div>
                </div>
                {p.type === "hunk" ? (
                  <HunkView lines={p.lines} prose={/\.mdx?$/.test(p.path)} />
                ) : IMAGE.test(p.path) && p.change !== "delete" ? (
                  <img
                    className="thumb"
                    src={`${base}/file?path=${encodeURIComponent(p.path)}&v=${p.id}`}
                    alt={p.path}
                  />
                ) : (
                  <div className="small muted" style={{ padding: "10px 12px" }}>
                    {p.change === "new" && /\.mdx?$/.test(p.path)
                      ? "새 원고 파일입니다. 원고 탭의 미리보기로 읽고 수락하면, 그 뒤에 고친 곳부터 덩어리로 보입니다."
                      : p.change === "delete"
                        ? "에이전트가 이 파일을 지웠습니다. 거절하면 되살립니다."
                        : "파일 전체를 수락하거나 거절합니다."}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="stack">
        <div className="card stack">
          <h3>커밋할 변경 {staged.length}</h3>
          {staged.length === 0 ? (
            <div className="small muted">수락한 변경이 아직 없습니다.</div>
          ) : (
            <div className="stack" style={{ gap: 4 }}>
              {staged.map(file => (
                <div
                  key={file.path}
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
                  <span
                    className="mono small"
                    style={{ overflowWrap: "anywhere", minWidth: 0 }}
                  >
                    {file.status} {file.path}
                  </span>
                  <button
                    className="btn ghost small"
                    onClick={async () => {
                      await action.run("unstage", () =>
                        send(`${base}/unstage`, { path: file.path })
                      );
                      refresh();
                    }}
                  >
                    수락 취소
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="field">
            <span>커밋 메시지</span>
            <input value={message} onChange={e => setMessage(e.target.value)} />
          </label>
          <button
            className="btn primary"
            disabled={
              staged.length === 0 || !message.trim() || action.busy !== null
            }
            onClick={commit}
          >
            커밋
          </button>
          <div className="small muted">
            커밋은 브랜치 {record.branch}에만 남습니다. 올리기(push)와 PR은 발행
            탭에서 합니다.
          </div>
        </div>
      </div>

      <Confirm
        open={confirm !== null}
        title={
          confirm === "accept"
            ? `제안 ${proposals.length}개를 모두 수락할까요?`
            : `제안 ${proposals.length}개를 모두 거절할까요?`
        }
        confirmLabel={confirm === "accept" ? "모두 수락" : "모두 거절"}
        danger={confirm === "reject"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const verdict = confirm;
          setConfirm(null);
          if (verdict)
            void decide(
              proposals.map(p => p.id),
              verdict
            );
        }}
      >
        {confirm === "accept"
          ? "화면에 보이는 제안만 수락합니다. 그사이 에이전트가 더 고친 곳은 남습니다."
          : "거절한 덩어리는 작업 트리에서 되돌리고 .studio/rejected/에 보관합니다."}
      </Confirm>
    </div>
  );
}
