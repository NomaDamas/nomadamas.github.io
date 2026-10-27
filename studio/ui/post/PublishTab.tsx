import { useEffect, useState } from "react";
import { Confirm, ErrorNote, Markdown } from "../components.tsx";
import { send, useAction, usePoll, type Detail, type PrInfo } from "../lib.ts";

type PublishInfo = {
  pr: PrInfo | null;
  checks: { name: string; state: string; bucket: string; link: string }[];
  deploy: { status: string; conclusion: string; url: string } | null;
  live: { status: number | null; hasTitle: boolean; url: string } | null;
  branch: { head: string; ahead: number | null } | null;
  front: { pubDatetime?: string; draft?: string; title?: string };
  defaultTitle: string;
  defaultBody: string;
};

type Ask = "pr" | "merge" | "cleanup" | null;

export function PublishTab({
  detail,
  refresh,
}: {
  detail: Detail;
  refresh: () => void;
}) {
  const { record } = detail;
  const base = `/api/posts/${encodeURIComponent(record.id)}`;
  const {
    data,
    error,
    refresh: reload,
  } = usePoll<PublishInfo>(`${base}/publish`, 8000);
  const action = useAction();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ask, setAsk] = useState<Ask>(null);

  useEffect(() => {
    if (data && !title) setTitle(data.defaultTitle);
    if (data && !body) setBody(data.defaultBody);
  }, [data, title, body]);

  if (!data)
    return (
      <div className="muted">{error ?? "PR과 배포 상태를 불러오는 중…"}</div>
    );

  const pr = data.pr;
  const open = pr?.state === "OPEN";
  const merged = pr?.state === "MERGED";
  const pending = detail.proposals.length;
  const staged = detail.staged.length;
  const unpushed = data.branch?.ahead ?? null;
  const checksDone =
    data.checks.length > 0 &&
    data.checks.every(c => c.bucket === "pass" || c.bucket === "skipping");
  const checksFailed = data.checks.some(
    c => c.bucket === "fail" || c.bucket === "cancel"
  );
  const canMerge =
    open &&
    checksDone &&
    pending === 0 &&
    staged === 0 &&
    (unpushed ?? 0) === 0;
  const live = data.live?.status === 200 && data.live.hasTitle;
  // 머지 직전에 맞춘 시각인지. 6시간 안이면 맞춘 것으로 본다
  const pubTime = Date.parse(data.front.pubDatetime ?? "");
  const freshPubDatetime =
    Number.isFinite(pubTime) &&
    Math.abs(Date.now() - pubTime) < 6 * 60 * 60 * 1000;

  async function act(name: string, fn: () => Promise<unknown>) {
    await action.run(name, fn);
    reload();
    refresh();
  }

  const steps = [
    {
      title: "원고 커밋",
      done: pending === 0 && staged === 0,
      body:
        pending > 0 || staged > 0 ? (
          <div className="small">
            검토하지 않은 제안 {pending}개, 커밋하지 않은 수락분 {staged}개가
            있습니다. 제안 탭에서 정리한 뒤 진행합니다.
          </div>
        ) : (
          <div className="small muted">커밋하지 않은 변경이 없습니다.</div>
        ),
    },
    {
      title: "올리기와 PR",
      done: Boolean(open || merged),
      body: pr ? (
        <>
          <div className="row small">
            <a href={pr.url} target="_blank" rel="noreferrer">
              PR #{pr.number}
            </a>
            <span className={`badge ${merged ? "green" : open ? "blue" : ""}`}>
              {merged ? "머지됨" : open ? "열림" : "닫힘"}
            </span>
            {unpushed !== null && unpushed > 0 && (
              <span className="badge yellow">올리지 않은 커밋 {unpushed}</span>
            )}
          </div>
          {open && unpushed !== null && unpushed > 0 && (
            <div>
              <button
                className="btn small"
                disabled={action.busy !== null}
                onClick={() => act("push", () => send(`${base}/publish/push`))}
              >
                새 커밋 올리기(push)
              </button>
            </div>
          )}
          {open && (
            <div className="stack" style={{ gap: 2 }}>
              {data.checks.length === 0 && (
                <div className="small muted">PR 검사를 기다리는 중</div>
              )}
              {data.checks.map(c => (
                <div key={c.name} className="row small">
                  <span
                    className={`badge ${c.bucket === "pass" ? "green" : c.bucket === "fail" ? "red" : "yellow"}`}
                  >
                    {c.bucket === "pass"
                      ? "통과"
                      : c.bucket === "fail"
                        ? "실패"
                        : c.bucket === "pending"
                          ? "진행 중"
                          : c.state}
                  </span>
                  <a href={c.link} target="_blank" rel="noreferrer">
                    {c.name}
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <label className="field">
            <span>PR 제목</span>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>PR 본문</span>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              style={{ minHeight: 160 }}
              className="mono"
            />
            <small>
              공개 저장소입니다. 내부 수치, 비공개 저장소 링크, 로컬 경로를 적지
              않습니다.
            </small>
          </label>
          <div>
            <button
              className="btn primary"
              disabled={
                pending > 0 ||
                staged > 0 ||
                !title.trim() ||
                action.busy !== null
              }
              onClick={() => setAsk("pr")}
            >
              브랜치 올리고 PR 열기
            </button>
          </div>
        </>
      ),
    },
    {
      title: "발행 시각",
      done: merged || freshPubDatetime,
      hidden: record.mode === "fix",
      body: (
        <>
          <div className="small">
            지금 값{" "}
            <span className="mono">{data.front.pubDatetime ?? "없음"}</span>
            {data.front.draft === "true" && (
              <span className="badge yellow" style={{ marginLeft: 6 }}>
                draft: true
              </span>
            )}
          </div>
          <div className="small muted">
            블로그는 머지 직전 시각을 발행 시각으로 씁니다. 머지하기 바로 전에
            누르면 지금 한국 시각으로 바꾸고 커밋합니다.
          </div>
          <div>
            <button
              className="btn small"
              disabled={
                merged || pending > 0 || staged > 0 || action.busy !== null
              }
              onClick={() =>
                act("pubdate", () => send(`${base}/publish/pubdate`))
              }
            >
              지금 시각으로 맞추고 커밋
            </button>
          </div>
        </>
      ),
    },
    {
      title: "머지 = 발행",
      done: merged,
      body: merged ? (
        <div className="small muted">머지했습니다.</div>
      ) : (
        <>
          <div className="small muted">
            머지하면 deploy.yml이 바로 배포합니다. PR 검사가 모두 통과하고,
            올리지 않은 커밋과 남은 제안이 없을 때만 누를 수 있습니다.
            {checksFailed && " 실패한 검사가 있습니다."}
          </div>
          <div>
            <button
              className="btn primary"
              disabled={!canMerge || action.busy !== null}
              onClick={() => setAsk("merge")}
            >
              머지해서 발행
            </button>
          </div>
        </>
      ),
    },
    {
      title: "배포",
      done: data.deploy?.conclusion === "success",
      body: !merged ? (
        <div className="small muted">머지하면 배포 상태가 보입니다.</div>
      ) : data.deploy ? (
        <div className="row small">
          <span
            className={`badge ${data.deploy.conclusion === "success" ? "green" : data.deploy.conclusion ? "red" : "yellow"}`}
          >
            {data.deploy.conclusion || data.deploy.status}
          </span>
          <a href={data.deploy.url} target="_blank" rel="noreferrer">
            배포 기록
          </a>
        </div>
      ) : (
        <div className="small muted">배포 작업을 찾는 중</div>
      ),
    },
    {
      title: "사이트 확인",
      done: live,
      body: !merged ? (
        <div className="small muted">
          배포가 끝나면 실제 주소를 열어 제목이 보이는지 확인합니다.
        </div>
      ) : (
        <div className="row small">
          <span className={`badge ${live ? "green" : "yellow"}`}>
            {live
              ? "올라감"
              : data.live?.status
                ? `응답 ${data.live.status}`
                : "확인 중"}
          </span>
          {data.live && (
            <a href={data.live.url} target="_blank" rel="noreferrer">
              {data.live.url}
            </a>
          )}
        </div>
      ),
    },
    {
      title: "공유 글",
      done: Boolean(detail.share),
      body: (
        <>
          {detail.share ? (
            <Markdown source={detail.share} />
          ) : (
            <div className="small muted">
              사이트에 올라간 뒤 Threads, X, YouTube 커뮤니티 문안을
              에이전트에게 맡깁니다. 게시는 직접 합니다.
            </div>
          )}
          <div>
            <button
              className="btn small"
              disabled={!record.agent || !live || action.busy !== null}
              onClick={() =>
                act("share", () =>
                  send(`${base}/agent/message`, { kind: "share" })
                )
              }
            >
              공유 글 요청
            </button>
          </div>
        </>
      ),
    },
    {
      title: "정리",
      done: false,
      body: (
        <>
          <div className="small muted">
            글 worktree를 지우고 목록에서 숨깁니다. 작업 폴더와 브랜치, 코멘트
            기록은 남습니다. 커밋하지 않은 변경이 있으면 git이 거절합니다.
          </div>
          <div>
            <button
              className="btn small"
              disabled={!merged || action.busy !== null}
              onClick={() => setAsk("cleanup")}
            >
              worktree 정리
            </button>
          </div>
        </>
      ),
    },
  ].filter(step => !("hidden" in step && step.hidden));

  const firstOpen = steps.findIndex(step => !step.done);

  return (
    <div style={{ maxWidth: 820 }}>
      <ErrorNote error={action.error} />
      <div className="card" style={{ marginTop: action.error ? 12 : 0 }}>
        {steps.map((step, i) => (
          <div
            key={step.title}
            className={`publish-step ${step.done ? "done" : i === firstOpen ? "now" : ""}`}
          >
            <span className="num">{step.done ? "✓" : i + 1}</span>
            <div className="content">
              <strong>{step.title}</strong>
              {step.body}
            </div>
          </div>
        ))}
      </div>

      <Confirm
        open={ask === "pr"}
        title="공개 저장소에 올리고 PR을 열까요?"
        confirmLabel="올리고 PR 열기"
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          setAsk(null);
          void act("pr", () => send(`${base}/publish/pr`, { title, body }));
        }}
      >
        브랜치 {record.branch}를 origin에 올리고 main으로 가는 PR을 엽니다.
        PR마다 빌드 검사가 돕니다.
      </Confirm>
      <Confirm
        open={ask === "merge"}
        title="머지해서 발행할까요?"
        confirmLabel="머지해서 발행"
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          setAsk(null);
          if (pr)
            void act("merge", () =>
              send(`${base}/publish/merge`, { headSha: pr.headRefOid })
            );
        }}
      >
        PR #{pr?.number}을 머지하면 바로 배포되어{" "}
        {detail.siteUrl.replace(/^https?:\/\//, "")}/posts/{record.slug}/에
        올라갑니다. 화면에서 본 커밋({pr?.headRefOid.slice(0, 7)}) 그대로일 때만
        머지합니다.
      </Confirm>
      <Confirm
        open={ask === "cleanup"}
        title="worktree를 정리할까요?"
        confirmLabel="정리"
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          setAsk(null);
          void act("cleanup", () => send(`${base}/cleanup`));
        }}
      >
        {record.worktree}를 지우고 이 글을 목록에서 숨깁니다.
      </Confirm>
    </div>
  );
}
