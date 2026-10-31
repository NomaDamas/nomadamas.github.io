import { useEffect, useState } from "react";
import { AgentChooser, ErrorNote } from "../components.tsx";
import { api, navigate, send, useAction, type Meta } from "../lib.ts";

type Published = { slug: string; title: string; pubDatetime: string };

export function FixPost({ meta }: { meta: Meta | null }) {
  const [posts, setPosts] = useState<Published[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [slug, setSlug] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<"claude" | "codex" | "none">("none");
  const [workspace, setWorkspace] = useState("");
  const action = useAction();

  useEffect(() => {
    api<{ posts: Published[] }>("/api/published")
      .then(data => setPosts(data.posts))
      .catch(e => setLoadError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    if (!meta) return;
    setWorkspace(
      prev =>
        prev ||
        meta.settings.herdrWorkspace ||
        (meta.herdr.workspaces[0]?.id ?? "")
    );
  }, [meta]);

  const filtered = (posts ?? []).filter(
    p =>
      !query || p.title.includes(query) || p.slug.includes(query.toLowerCase())
  );

  async function submit() {
    let id = "";
    const ok = await action.run("create", async () => {
      const result = await send<{ id: string }>("/api/fixes", {
        slug,
        notes,
        agent: kind === "none" ? null : { kind, workspaceId: workspace },
      });
      id = result.id;
    });
    if (ok) navigate(`/post/${encodeURIComponent(id)}`);
  }

  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>발행된 글 고치기</h1>
          <div className="muted">
            main에서 고치기 브랜치(fix/글-날짜)를 따서 worktree를 만듭니다.
            미리보기에 코멘트를 남기면 에이전트가 고치고, 바뀐 곳은 덩어리마다
            수락합니다.
          </div>
        </div>

        <label className="field">
          <span>어느 글인가요</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="제목이나 주소로 찾기"
          />
        </label>
        {loadError && <div className="notice error">{loadError}</div>}
        {!posts && !loadError && (
          <div className="muted">main의 글 목록을 불러오는 중…</div>
        )}
        <div
          className="stack"
          style={{ gap: 6, maxHeight: 320, overflowY: "auto" }}
        >
          {filtered.map(p => (
            <label
              key={p.slug}
              className="panel row"
              style={{
                cursor: "pointer",
                padding: "9px 12px",
                borderColor: slug === p.slug ? "var(--accent)" : undefined,
                background: slug === p.slug ? "var(--accent-soft)" : undefined,
              }}
            >
              <input
                type="radio"
                name="post"
                checked={slug === p.slug}
                onChange={() => setSlug(p.slug)}
              />
              <span style={{ flex: 1, minWidth: 0 }}>{p.title}</span>
              <span className="mono faint">{p.slug}</span>
              <span className="small faint">{p.pubDatetime.slice(0, 10)}</span>
            </label>
          ))}
        </div>

        <label className="field">
          <span>고칠 것</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="비워 두고 미리보기에서 코멘트로 짚어도 됩니다"
          />
        </label>

        <div className="panel">
          <AgentChooser
            meta={meta}
            kind={kind}
            setKind={setKind}
            workspace={workspace}
            setWorkspace={setWorkspace}
          />
        </div>

        <ErrorNote error={action.error} />
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={() => history.back()}>
            취소
          </button>
          <button
            className="btn primary"
            disabled={!slug || action.busy !== null}
            onClick={submit}
          >
            {action.busy ? "만드는 중…" : "고치기 시작"}
          </button>
        </div>
      </div>
    </main>
  );
}
