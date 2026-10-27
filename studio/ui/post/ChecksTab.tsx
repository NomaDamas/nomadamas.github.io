import { ErrorNote, Markdown } from "../components.tsx";
import {
  send,
  timeAgo,
  useAction,
  type CheckItem,
  type Detail,
} from "../lib.ts";

const ORDER = { fail: 0, warn: 1, pass: 2 } as const;
const ICON = { fail: "✕", warn: "!", pass: "✓" } as const;

function Items({ items }: { items: CheckItem[] }) {
  return (
    <div>
      {[...items]
        .sort((a, b) => ORDER[a.level] - ORDER[b.level])
        .map(item => (
          <div key={item.id} className={`check ${item.level}`}>
            <span className="icon">{ICON[item.level]}</span>
            <span>
              {item.title}
              {item.line ? (
                <span className="faint small"> · {item.line}줄</span>
              ) : null}
            </span>
            {item.detail && <span className="detail">{item.detail}</span>}
          </div>
        ))}
    </div>
  );
}

export function ChecksTab({
  detail,
  refresh,
}: {
  detail: Detail;
  refresh: () => void;
}) {
  const { record, checks, build } = detail;
  const base = `/api/posts/${encodeURIComponent(record.id)}`;
  const action = useAction();
  const meta = checks?.build?.meta ?? null;
  const stale = detail.facts.checks.stale;
  const domain = detail.siteUrl.replace(/^https?:\/\//, "");
  const description =
    meta?.description ?? detail.facts.draft.front.description ?? "";
  const title =
    meta?.og.title ?? detail.facts.draft.front.title ?? detail.summary.title;

  return (
    <div className="two-col">
      <div className="stack">
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h3>빠른 점검</h3>
              <div className="small muted">
                원고 파일만 읽습니다. 빌드를 멈추는 규칙, 제목과 설명, 이미지,
                키워드 자리, 근거 표, 지난 교정을 봅니다. 처음 한 번은 글
                worktree에 의존성을 설치해서 조금 걸립니다.
              </div>
            </div>
            <button
              className="btn primary"
              disabled={!detail.facts.draft.exists || action.busy !== null}
              onClick={async () => {
                await action.run("quick", () => send(`${base}/checks/quick`));
                refresh();
              }}
            >
              {action.busy === "quick" ? "점검 중…" : "빠른 점검"}
            </button>
          </div>
          {checks && (
            <div className="small muted">
              {timeAgo(checks.checkedAt)} 점검
              {stale && (
                <span className="badge yellow" style={{ marginLeft: 6 }}>
                  그 뒤 원고가 바뀜
                </span>
              )}
            </div>
          )}
          {checks ? (
            <Items items={checks.items} />
          ) : (
            <div className="muted small">아직 돌리지 않았습니다.</div>
          )}
        </div>

        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h3>빌드 점검</h3>
              <div className="small muted">
                글 worktree에서 pnpm build를 돌려 나온 페이지의 메타 태그,
                구조화 데이터, llms.txt, sitemap을 봅니다. 1분쯤 걸립니다.
              </div>
            </div>
            <button
              className="btn"
              disabled={
                !detail.facts.draft.exists ||
                build.running ||
                action.busy !== null
              }
              onClick={async () => {
                await action.run("build", () => send(`${base}/checks/build`));
                refresh();
              }}
            >
              {build.running ? "빌드 중…" : "빌드 점검"}
            </button>
          </div>
          {build.running && (
            <pre className="log">{build.log.join("\n") || "…"}</pre>
          )}
          {checks?.build && (
            <div className="small muted">
              {timeAgo(checks.build.at)} 빌드 ·{" "}
              {checks.build.ok ? "성공" : "실패"}
            </div>
          )}
          {detail.buildItems.length > 0 && <Items items={detail.buildItems} />}
        </div>

        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h3>AI 점검</h3>
              <div className="small muted">
                에이전트에게 스킬의 검수 절차(humanize-korean, patina)를
                맡깁니다. 고친 곳은 제안 탭에 쌓입니다.
              </div>
            </div>
            <button
              className="btn"
              disabled={!record.agent || action.busy !== null}
              onClick={() =>
                action.run("ai", () =>
                  send(`${base}/agent/message`, { kind: "ai-review" })
                )
              }
            >
              AI 점검 요청
            </button>
          </div>
          {detail.aiReview ? (
            <Markdown source={detail.aiReview} />
          ) : (
            <div className="small muted">
              결과는 작업 폴더의 ai-review.md에 쌓이면 여기 보입니다.
            </div>
          )}
        </div>
        <ErrorNote error={action.error} />
      </div>

      <div className="stack">
        <div className="card stack">
          <h3>검색 결과에서</h3>
          <div className="serp">
            <div className="site">
              {domain} › posts › {record.slug}
            </div>
            <div className="serp-title">{meta?.title ?? title}</div>
            <div className="serp-desc">
              {description || "설명이 없습니다. 구글이 본문에서 골라 씁니다."}
            </div>
          </div>
          <div className="small faint">
            구글은 제목과 설명을 바꿔 보여 줄 수 있습니다. 폭에 맞춰 잘리는
            모습만 어림합니다.
          </div>
        </div>
        <div className="card stack">
          <h3>공유했을 때</h3>
          {!meta && (
            <div className="small muted">
              빌드 점검을 돌리면 실제 공유 이미지로 보여 줍니다.
            </div>
          )}
          <div className="share-card">
            {meta?.ogImageFile ? (
              <img
                src={`${base}/og.png?v=${checks?.build?.at ?? ""}`}
                alt={meta.og["image:alt"] ?? ""}
              />
            ) : (
              <img alt="" style={{ visibility: meta ? "visible" : "hidden" }} />
            )}
            <div className="body">
              <div className="domain">{domain}</div>
              <div className="t">{title}</div>
              <div className="d">{meta?.og.description ?? description}</div>
            </div>
          </div>
          {meta && (
            <div
              className="small muted mono"
              style={{ overflowWrap: "anywhere" }}
            >
              og:image {meta.og.image}
              {meta.og["image:width"] &&
                ` · ${meta.og["image:width"]}x${meta.og["image:height"]}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
