import { useEffect, useState } from "react";
import { ErrorNote } from "../components.tsx";
import { send, useAction, type Meta } from "../lib.ts";

type Editable = {
  workRoot: string;
  worktreeRoot: string;
  agentCwd: string;
  herdrSession: string;
  herdrWorkspace: string;
  agentKind: string;
};

const FIELDS: { key: keyof Editable; label: string; help: string }[] = [
  {
    key: "workRoot",
    label: "작업 폴더를 만들 곳",
    help: "글마다 <YYMMDD>-<slug> 폴더가 생깁니다. 요청서, 브리프, 근거 표, 캡처 원본, 코멘트가 여기 남습니다. 글쓰기 스킬이 든 저장소 안처럼 다시 찍을 때 찾을 수 있는 곳을 고릅니다.",
  },
  {
    key: "worktreeRoot",
    label: "글 worktree를 만들 곳",
    help: "post/<slug>, fix/<slug>-<날짜> 폴더가 생깁니다. 세션 임시 폴더는 비워질 수 있어 피합니다.",
  },
  {
    key: "agentCwd",
    label: "에이전트를 띄울 폴더",
    help: "비우면 작업 폴더가 든 git 저장소의 루트에서 띄웁니다. 그래야 그 저장소의 스킬(nomadamas-blog)이 보입니다.",
  },
  { key: "herdrSession", label: "herdr 세션", help: "비우면 기본 세션." },
  {
    key: "herdrWorkspace",
    label: "기본 herdr 워크스페이스",
    help: "새 글 폼에서 먼저 골라 둘 워크스페이스 id. 예: w0",
  },
];

export function SettingsPage({
  meta,
  onSaved,
}: {
  meta: Meta | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Editable | null>(null);
  const action = useAction();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (meta && !form) {
      const s = meta.settings;
      setForm({
        workRoot: s.workRoot,
        worktreeRoot: s.worktreeRoot,
        agentCwd: s.agentCwd,
        herdrSession: s.herdrSession,
        herdrWorkspace: s.herdrWorkspace,
        agentKind: s.agentKind,
      });
    }
  }, [meta, form]);

  if (!meta || !form) return <main className="page muted">불러오는 중…</main>;

  async function save() {
    setSaved(false);
    const ok = await action.run("save", () =>
      send("/api/settings", form, "PUT")
    );
    if (ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>설정</h1>
          <div className="muted small">
            저장소 {meta.repoRoot}. 설정은 {meta.stateDir}/config.json에
            저장되고 git에 올라가지 않습니다. 환경 변수(STUDIO_WORK_ROOT 등)를
            주면 그 값이 이깁니다.
          </div>
        </div>

        {FIELDS.map(field => {
          const locked = meta.lockedByEnv.includes(field.key);
          return (
            <label key={field.key} className="field">
              <span>
                {field.label}{" "}
                {locked && <span className="badge">환경 변수</span>}
              </span>
              <input
                className="mono"
                value={form[field.key]}
                disabled={locked}
                onChange={e =>
                  setForm({ ...form, [field.key]: e.target.value })
                }
              />
              <small>{field.help}</small>
            </label>
          );
        })}

        <label className="field">
          <span>기본 에이전트</span>
          <select
            value={form.agentKind}
            onChange={e => setForm({ ...form, agentKind: e.target.value })}
          >
            <option value="claude">Claude Code</option>
            <option value="codex">Codex</option>
          </select>
        </label>

        <div className="panel stack" style={{ gap: 6 }}>
          <div className="section-title">연결 상태</div>
          <div className="row small">
            <span
              className={`badge ${meta.herdr.available && !meta.herdr.error ? "green" : "red"}`}
            >
              herdr{" "}
              {meta.herdr.available
                ? meta.herdr.error
                  ? "연결 안 됨"
                  : `워크스페이스 ${meta.herdr.workspaces.length}개`
                : "없음"}
            </span>
            <span className={`badge ${meta.agents.claude ? "green" : ""}`}>
              claude {meta.agents.claude ? "있음" : "없음"}
            </span>
            <span className={`badge ${meta.agents.codex ? "green" : ""}`}>
              codex {meta.agents.codex ? "있음" : "없음"}
            </span>
            <span className={`badge ${meta.gh ? "green" : "red"}`}>
              gh {meta.gh ? "있음" : "없음"}
            </span>
          </div>
          {meta.herdr.error && (
            <div className="small muted">{meta.herdr.error}</div>
          )}
        </div>

        <ErrorNote error={action.error} />
        {saved && <div className="notice ok">저장했습니다.</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button
            className="btn primary"
            disabled={action.busy !== null}
            onClick={save}
          >
            저장
          </button>
        </div>
      </div>
    </main>
  );
}
