import { useEffect, useState } from "react";
import {
  AgentChooser,
  ErrorNote,
  Stepper,
  WaitingBadge,
} from "../components.tsx";
import {
  send,
  timeAgo,
  useAction,
  usePoll,
  type Detail,
  type Meta,
} from "../lib.ts";
import { BriefTab } from "../post/BriefTab.tsx";
import { DraftTab } from "../post/DraftTab.tsx";
import { ChangesTab } from "../post/ChangesTab.tsx";
import { ChecksTab } from "../post/ChecksTab.tsx";
import { PublishTab } from "../post/PublishTab.tsx";

type TabKey = "brief" | "draft" | "changes" | "checks" | "publish";

function defaultTab(detail: Detail): TabKey {
  const { stage } = detail.summary.progress;
  if (detail.proposals.length > 0 && stage !== "new" && stage !== "brief")
    return "changes";
  if (stage === "new" || stage === "brief" || stage === "handson")
    return detail.record.mode === "fix" ? "draft" : "brief";
  if (stage === "checks") return "checks";
  if (stage === "publish" || stage === "after") return "publish";
  return "draft";
}

export function PostPage({
  id,
  meta,
  setCrumb,
}: {
  id: string;
  meta: Meta | null;
  setCrumb: (crumb: string) => void;
}) {
  const url = `/api/posts/${encodeURIComponent(id)}`;
  const { data, error, refresh } = usePoll<Detail>(url, 2000);
  const [tab, setTab] = useState<TabKey | null>(null);

  useEffect(() => {
    if (data) setCrumb(data.summary.title);
  }, [data?.summary.title, setCrumb]);

  useEffect(() => {
    if (data && tab === null) setTab(defaultTab(data));
  }, [data, tab]);

  if (error && !data)
    return (
      <main className="page">
        <div className="notice error">{error}</div>
      </main>
    );
  if (!data || !tab) return <main className="page muted">불러오는 중…</main>;

  const { summary, record, facts } = data;
  const failed =
    (data.checks?.items ?? []).filter(i => i.level === "fail").length +
    data.buildItems.filter(i => i.level === "fail").length;
  const tabs: { key: TabKey; label: string; count?: number; hint?: boolean }[] =
    [
      {
        key: "brief",
        label: record.mode === "fix" ? "요청" : "브리프",
        hint: facts.brief.text !== null && !facts.brief.approved,
      },
      {
        key: "draft",
        label: "원고",
        count: summary.counts.agentQuestions || undefined,
      },
      {
        key: "changes",
        label: "제안",
        count: data.proposals.length || undefined,
      },
      { key: "checks", label: "점검", count: failed || undefined },
      { key: "publish", label: "발행" },
    ];

  return (
    <main className="page wide">
      <div className="post-head">
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <h1>{summary.title}</h1>
            <div className="row small muted">
              {record.mode === "fix" && (
                <span className="badge purple">고치기</span>
              )}
              <span className="mono">{record.branch}</span>
              <span className="faint">
                마지막 변화 {timeAgo(facts.lastActivity)}
              </span>
            </div>
          </div>
          <AgentPanel detail={data} meta={meta} onChange={refresh} />
        </div>
        <Stepper stage={summary.progress.stage} />
        <div className="status-line">
          <WaitingBadge summary={summary} />
          <span>{summary.progress.note}</span>
          {summary.progress.stalled && record.agent && (
            <NudgeButton id={record.id} />
          )}
        </div>
        {summary.gitError && (
          <div className="notice error">{summary.gitError}</div>
        )}
      </div>

      <nav className="tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count ? <span className="count">{t.count}</span> : null}
            {t.hint ? (
              <span className="count" style={{ background: "var(--yellow)" }}>
                승인
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === "brief" && <BriefTab detail={data} refresh={refresh} />}
      {tab === "draft" && <DraftTab detail={data} refresh={refresh} />}
      {tab === "changes" && <ChangesTab detail={data} refresh={refresh} />}
      {tab === "checks" && <ChecksTab detail={data} refresh={refresh} />}
      {tab === "publish" && <PublishTab detail={data} refresh={refresh} />}
    </main>
  );
}

function NudgeButton({ id }: { id: string }) {
  const action = useAction();
  const [done, setDone] = useState(false);
  return (
    <>
      <button
        className="btn small"
        disabled={action.busy !== null}
        onClick={async () => {
          if (
            await action.run("nudge", () =>
              send(`/api/posts/${encodeURIComponent(id)}/agent/message`, {
                kind: "nudge",
              })
            )
          )
            setDone(true);
        }}
      >
        에이전트에게 진행 물어보기
      </button>
      {done && <span className="small muted">보냈습니다</span>}
      {action.error && (
        <span className="small" style={{ color: "var(--red)" }}>
          {action.error}
        </span>
      )}
    </>
  );
}

function AgentPanel({
  detail,
  meta,
  onChange,
}: {
  detail: Detail;
  meta: Meta | null;
  onChange: () => void;
}) {
  const { record } = detail;
  const base = `/api/posts/${encodeURIComponent(record.id)}`;
  const { data: status, refresh } = usePoll<{ alive: boolean; cwd: string }>(
    `${base}/agent`,
    10_000
  );
  const [choosing, setChoosing] = useState(false);
  const [kind, setKind] = useState<"claude" | "codex" | "none">(
    meta?.settings.agentKind ?? "claude"
  );
  const [workspace, setWorkspace] = useState(
    meta?.settings.herdrWorkspace || meta?.herdr.workspaces[0]?.id || ""
  );
  const action = useAction();
  const agent = record.agent;

  async function launch() {
    if (kind === "none") return;
    const ok = await action.run("launch", () =>
      send(`${base}/agent`, { kind, workspaceId: workspace })
    );
    if (ok) {
      setChoosing(false);
      onChange();
      setTimeout(refresh, 4000);
    }
  }

  return (
    <div
      className="panel stack"
      style={{ gap: 8, minWidth: 280, maxWidth: 420 }}
    >
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="section-title" style={{ margin: 0 }}>
          에이전트
        </span>
        {agent && (
          <span
            className={`badge ${agent.status === "error" ? "red" : agent.status === "blocked" ? "yellow" : status?.alive ? "green" : agent.status === "starting" ? "blue" : ""}`}
          >
            {agent.status === "starting"
              ? "띄우는 중"
              : agent.status === "error"
                ? "오류"
                : agent.status === "blocked"
                  ? "확인 창에서 멈춤"
                  : status?.alive
                    ? `${agent.kind} 실행 중`
                    : "탭을 찾지 못함"}
          </span>
        )}
      </div>
      {agent ? (
        <div className="small muted">
          herdr {agent.workspaceId} · {agent.kind} · {timeAgo(agent.startedAt)}{" "}
          시작
          {status?.cwd && (
            <div className="mono faint" style={{ overflowWrap: "anywhere" }}>
              {status.cwd}
            </div>
          )}
        </div>
      ) : (
        <div className="small muted">
          아직 띄우지 않았습니다. 코멘트는 띄운 뒤에 전달됩니다.
        </div>
      )}
      {agent?.status === "error" && (
        <div className="notice error small">{agent.error}</div>
      )}
      {agent?.status === "blocked" && (
        <div className="notice warn small">{agent.error}</div>
      )}
      <div className="row">
        {agent?.status === "blocked" && status?.alive && (
          <>
            <button
              className="btn small"
              onClick={() =>
                action.run("focus", () => send(`${base}/agent/focus`))
              }
            >
              herdr 탭 보기
            </button>
            <button
              className="btn small primary"
              onClick={async () => {
                if (
                  await action.run("task", () =>
                    send(`${base}/agent/message`, { kind: "read-task" })
                  )
                )
                  onChange();
              }}
            >
              지시문 보내기
            </button>
          </>
        )}
        {agent?.status === "ready" && status?.alive && (
          <>
            <button
              className="btn small"
              onClick={() =>
                action.run("focus", () => send(`${base}/agent/focus`))
              }
            >
              herdr 탭 보기
            </button>
            <button
              className="btn small ghost"
              onClick={() =>
                action.run("task", () =>
                  send(`${base}/agent/message`, { kind: "read-task" })
                )
              }
            >
              지시문 다시 보내기
            </button>
          </>
        )}
        {(!agent ||
          agent.status === "error" ||
          (agent.status !== "starting" && status && !status.alive)) && (
          <button
            className="btn small primary"
            onClick={() => setChoosing(v => !v)}
          >
            {agent ? "다시 띄우기" : "에이전트 띄우기"}
          </button>
        )}
      </div>
      {choosing && (
        <div className="stack" style={{ gap: 8 }}>
          <AgentChooser
            meta={meta}
            kind={kind}
            setKind={setKind}
            workspace={workspace}
            setWorkspace={setWorkspace}
          />
          <button
            className="btn primary small"
            disabled={kind === "none" || action.busy !== null}
            onClick={launch}
          >
            새 탭에 띄우기
          </button>
        </div>
      )}
      <ErrorNote error={action.error} />
    </div>
  );
}
