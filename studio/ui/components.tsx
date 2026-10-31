import { useEffect, useRef, type ReactNode } from "react";
import type { Meta, StageKey, Summary } from "./lib.ts";
import { renderMarkdown } from "./markdown.ts";

export const STAGE_LABELS: Record<StageKey, string> = {
  new: "새 글",
  brief: "브리프",
  handson: "직접 써 보기",
  draft: "원고",
  checks: "점검",
  publish: "발행",
  after: "발행 뒤",
};

const ORDER: StageKey[] = [
  "new",
  "brief",
  "handson",
  "draft",
  "checks",
  "publish",
  "after",
];

export function Stepper({
  stage,
  compact,
}: {
  stage: StageKey;
  compact?: boolean;
}) {
  const current = ORDER.indexOf(stage);
  if (compact) {
    return (
      <span className="dots" title={`지금 단계: ${STAGE_LABELS[stage]}`}>
        {ORDER.map((key, i) => (
          <i
            key={key}
            className={i < current ? "done" : i === current ? "current" : ""}
          />
        ))}
      </span>
    );
  }
  return (
    <div className="stepper">
      {ORDER.map((key, i) => (
        <span
          key={key}
          className={`step ${i < current ? "done" : i === current ? "current" : ""}`}
        >
          {i < current ? "✓ " : ""}
          {STAGE_LABELS[key]}
        </span>
      ))}
    </div>
  );
}

export function WaitingBadge({ summary }: { summary: Summary }) {
  const { progress } = summary;
  if (progress.stalled) return <span className="badge red">멈춤 30분+</span>;
  if (progress.waitingOn === "person")
    return <span className="badge yellow">내 차례</span>;
  if (progress.waitingOn === "agent")
    return <span className="badge blue">에이전트 작업 중</span>;
  if (progress.waitingOn === "ci")
    return <span className="badge purple">검사 대기</span>;
  return <span className="badge green">끝</span>;
}

export function AgentBadge({ agent }: { agent: Summary["agent"] }) {
  if (!agent) return <span className="badge">에이전트 없음</span>;
  if (agent.status === "starting")
    return <span className="badge blue">{agent.kind} 띄우는 중</span>;
  if (agent.status === "blocked")
    return <span className="badge yellow">{agent.kind} 확인 창에서 멈춤</span>;
  if (agent.status === "error")
    return (
      <span className="badge red" title={agent.error}>
        {agent.kind} 오류
      </span>
    );
  return (
    <span className="badge">
      {agent.kind} · herdr {agent.workspaceId}
    </span>
  );
}

export function Markdown({ source }: { source: string }) {
  return (
    <div
      className="md"
      // markdown.ts가 모든 글자를 이스케이프한 뒤 정해진 태그만 만든다
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="notice error">{error}</div>;
}

/** 되돌리기 어려운 동작 앞에서 한 번 더 묻는다 */
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="confirm" onCancel={onCancel}>
      <div className="stack">
        <h3>{title}</h3>
        <div className="muted">{children}</div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={onCancel}>
            취소
          </button>
          <button
            className={`btn ${danger ? "danger" : "primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function AgentChooser({
  meta,
  kind,
  setKind,
  workspace,
  setWorkspace,
}: {
  meta: Meta | null;
  kind: "claude" | "codex" | "none";
  setKind: (kind: "claude" | "codex" | "none") => void;
  workspace: string;
  setWorkspace: (id: string) => void;
}) {
  const herdrOk = Boolean(meta?.herdr.available && !meta.herdr.error);
  return (
    <div className="stack">
      <label className="field">
        <span>에이전트</span>
        <div className="choice">
          {(["claude", "codex"] as const).map(name => (
            <label key={name}>
              <input
                type="radio"
                name="agent"
                checked={kind === name}
                disabled={!herdrOk || !meta?.agents[name]}
                onChange={() => setKind(name)}
              />
              {name === "claude" ? "Claude Code" : "Codex"}
              {meta && !meta.agents[name] && (
                <span className="faint small">(PATH에 없음)</span>
              )}
            </label>
          ))}
          <label>
            <input
              type="radio"
              name="agent"
              checked={kind === "none"}
              onChange={() => setKind("none")}
            />
            나중에 띄우기
          </label>
        </div>
        {!herdrOk && (
          <small>
            herdr에 연결하지 못해 에이전트를 띄울 수 없습니다.{" "}
            {meta?.herdr.error ?? ""}
          </small>
        )}
      </label>
      {kind !== "none" && (
        <label className="field">
          <span>herdr 워크스페이스</span>
          <select
            value={workspace}
            onChange={e => setWorkspace(e.target.value)}
          >
            {meta?.herdr.workspaces.map(w => (
              <option key={w.id} value={w.id}>
                {w.number}. {w.label || w.id}
              </option>
            ))}
          </select>
          <small>
            이 워크스페이스에 글 전용 탭을 새로 열어 에이전트를 띄웁니다. 쓰고
            있는 탭에는 입력하지 않습니다.
          </small>
        </label>
      )}
    </div>
  );
}
