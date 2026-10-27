import { useEffect, useState } from "react";
import { AgentChooser, ErrorNote } from "../components.tsx";
import { navigate, send, useAction, type Meta } from "../lib.ts";

const POST_TYPES = [
  "소개",
  "사용기",
  "비교",
  "따라 하기",
  "행사 후기",
  "생각 정리",
];

export function NewPost({ meta }: { meta: Meta | null }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [audience, setAudience] = useState("");
  const [postType, setPostType] = useState("");
  const [keyword, setKeyword] = useState("");
  const [references, setReferences] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<"claude" | "codex" | "none">("claude");
  const [workspace, setWorkspace] = useState("");
  const action = useAction();

  useEffect(() => {
    if (!meta) return;
    setKind(prev =>
      prev === "none"
        ? prev
        : meta.agents[meta.settings.agentKind]
          ? meta.settings.agentKind
          : "none"
    );
    setWorkspace(
      prev =>
        prev ||
        (meta.herdr.workspaces.some(w => w.id === meta.settings.herdrWorkspace)
          ? meta.settings.herdrWorkspace
          : (meta.herdr.workspaces[0]?.id ?? ""))
    );
  }, [meta]);

  const slugOk = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

  async function submit() {
    let id = "";
    const ok = await action.run("create", async () => {
      const result = await send<{ id: string }>("/api/posts", {
        input: { slug, title, audience, postType, keyword, references, notes },
        agent: kind === "none" ? null : { kind, workspaceId: workspace },
      });
      id = result.id;
    });
    if (ok) navigate(`/post/${encodeURIComponent(id)}`);
  }

  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>새 글</h1>
          <div className="muted">
            빈 칸은 비워 둬도 됩니다. 에이전트가 브리프에서 독자, 유형, 키워드를
            제안하고, 승인하기 전까지 원고를 쓰지 않습니다.
          </div>
        </div>

        <label className="field">
          <span>무엇에 대한 글인가요</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="예: k-skill 2.0에서 바뀐 것"
          />
        </label>

        <label className="field">
          <span>주소(slug)</span>
          <input
            value={slug}
            onChange={e => setSlug(e.target.value.toLowerCase())}
            placeholder="k-skill-v2"
            className="mono"
          />
          <small>
            글 주소 blog.nomadamas.org/posts/<b>{slug || "slug"}</b>/ 와 브랜치
            post/{slug || "slug"}에 씁니다. 영어 소문자, 숫자, 하이픈만.
          </small>
        </label>

        <div className="two-col">
          <label className="field">
            <span>독자</span>
            <input
              value={audience}
              onChange={e => setAudience(e.target.value)}
              placeholder="예: 에이전트를 처음 써 보는 개발자"
            />
          </label>
          <label className="field">
            <span>글 유형</span>
            <input
              list="post-types"
              value={postType}
              onChange={e => setPostType(e.target.value)}
              placeholder="소개, 사용기, 비교…"
            />
            <datalist id="post-types">
              {POST_TYPES.map(t => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
        </div>

        <label className="field">
          <span>검색 키워드</span>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="독자가 검색창에 칠 말. 예: 한국어 tts 모델"
          />
          <small>
            점검 탭이 제목, 설명, 첫 문단, 절 제목에 이 말이 들어갔는지 봅니다.
          </small>
        </label>

        <label className="field">
          <span>참고 자료</span>
          <textarea
            value={references}
            onChange={e => setReferences(e.target.value)}
            placeholder={"저장소, 릴리스, 참고 글 주소를 한 줄에 하나씩"}
          />
        </label>

        <label className="field">
          <span>메모</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="꼭 넣을 장면, 피할 표현, 마감 같은 것"
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
            disabled={!slugOk || action.busy !== null}
            onClick={submit}
          >
            {action.busy ? "만드는 중…" : "만들기"}
          </button>
        </div>
      </div>
    </main>
  );
}
