import { useState } from "react";
import {
  AgentBadge,
  Stepper,
  STAGE_LABELS,
  WaitingBadge,
} from "../components.tsx";
import { navigate, timeAgo, usePoll, type Meta, type Summary } from "../lib.ts";

export function Home({ meta }: { meta: Meta | null }) {
  const { data, error } = usePoll<{ posts: Summary[] }>("/api/posts", 3000);
  const [showHidden, setShowHidden] = useState(false);
  const posts = data?.posts ?? [];
  const visible = posts.filter(p => showHidden || !p.hidden);
  const hiddenCount = posts.filter(p => p.hidden).length;
  const mine = visible.filter(
    p => p.progress.waitingOn === "person" || p.progress.stalled
  );

  return (
    <main className="page">
      <div className="home-head">
        <div>
          <h1 style={{ fontSize: 24 }}>글</h1>
          <div className="muted">
            {meta?.siteUrl
              ? meta.siteUrl.replace(/^https?:\/\//, "")
              : "블로그"}
            에 올릴 글과 고치는 글.
            {mine.length > 0 && ` 내 차례인 글 ${mine.length}편.`}
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigate("/fix")}>
            발행된 글 고치기
          </button>
          <button className="btn primary" onClick={() => navigate("/new")}>
            새 글
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {data && visible.length === 0 && (
        <div className="empty stack" style={{ alignItems: "center" }}>
          <h3>아직 진행 중인 글이 없습니다</h3>
          <div className="muted" style={{ maxWidth: 520 }}>
            새 글을 만들면 블로그 저장소에 글 브랜치와 worktree를, 작업 폴더에
            요청서를 만들고 herdr 탭에 에이전트를 띄웁니다. 에이전트가 브리프를
            쓰면 여기서 승인하고, 원고는 미리보기에서 코멘트로 고칩니다.
          </div>
          <button className="btn primary" onClick={() => navigate("/new")}>
            새 글 시작
          </button>
        </div>
      )}

      <div className="post-list">
        {visible.map(post => (
          <div
            key={post.id}
            className="post-card"
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/post/${encodeURIComponent(post.id)}`)}
            onKeyDown={event => {
              if (event.key === "Enter")
                navigate(`/post/${encodeURIComponent(post.id)}`);
            }}
          >
            <div className="stack" style={{ gap: 4, minWidth: 0 }}>
              <div className="row">
                <span className="title">{post.title}</span>
                {post.mode === "fix" && (
                  <span className="badge purple">고치기</span>
                )}
                {post.hidden && <span className="badge">숨김</span>}
              </div>
              <div className="muted small">{post.progress.note}</div>
            </div>
            <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
              <WaitingBadge summary={post} />
              <span className="small muted">
                {STAGE_LABELS[post.progress.stage]}
              </span>
            </div>
            <div className="meta row small muted">
              <Stepper stage={post.progress.stage} compact />
              <span className="mono">{post.slug}</span>
              <AgentBadge agent={post.agent} />
              {post.counts.proposals > 0 && (
                <span className="badge yellow">
                  제안 {post.counts.proposals}
                </span>
              )}
              {post.counts.openComments > 0 && (
                <span className="badge">코멘트 {post.counts.openComments}</span>
              )}
              {post.counts.agentQuestions > 0 && (
                <span className="badge purple">
                  질문 {post.counts.agentQuestions}
                </span>
              )}
              {post.pr && (
                <span className="badge">
                  PR #{post.pr.number}{" "}
                  {post.pr.state === "MERGED"
                    ? "머지됨"
                    : post.pr.state === "OPEN"
                      ? "열림"
                      : "닫힘"}
                </span>
              )}
              {post.gitError && (
                <span className="badge red">{post.gitError}</span>
              )}
              <span className="faint">
                마지막 변화 {timeAgo(post.lastActivity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            className="btn ghost small"
            onClick={() => setShowHidden(v => !v)}
          >
            {showHidden ? "숨긴 글 감추기" : `숨긴 글 ${hiddenCount}편 보기`}
          </button>
        </div>
      )}
    </main>
  );
}
