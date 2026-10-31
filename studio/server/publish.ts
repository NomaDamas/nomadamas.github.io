import { readFileSync, writeFileSync } from "node:fs";
import { run, runOk, which } from "./exec.ts";
import { aheadOfRemote, git, headSha } from "./git.ts";
import { draftPath, seoulIso, type PrInfo } from "./posts.ts";
import type { PostRecord } from "./store.ts";

// 발행은 블로그 저장소의 PR 흐름 그대로다. 머지하면 deploy.yml이 바로 배포하므로 머지가 곧 발행이다.
// 여기 있는 동작은 모두 사람이 스튜디오에서 누를 때만 돈다(api.ts의 person 검사).

function gh(args: string[], cwd: string) {
  const bin = which("gh");
  if (!bin) throw new Error("gh가 PATH에 없습니다.");
  return run(bin, args, { cwd, timeoutMs: 60_000 });
}

const prCache = new Map<string, { at: number; pr: PrInfo | null }>();

export async function prInfo(
  record: PostRecord,
  maxAgeMs = 15_000
): Promise<PrInfo | null> {
  const cached = prCache.get(record.id);
  if (cached && Date.now() - cached.at < maxAgeMs) return cached.pr;
  const result = await gh(
    [
      "pr",
      "list",
      "--head",
      record.branch,
      "--state",
      "all",
      "--limit",
      "1",
      "--json",
      "number,url,state,headRefOid,mergedAt,mergeCommit,isDraft",
    ],
    record.worktree
  );
  let pr: PrInfo | null = null;
  if (result.code === 0) {
    const list = JSON.parse(result.stdout || "[]") as (Omit<
      PrInfo,
      "mergeCommit"
    > & { mergeCommit: { oid: string } | null })[];
    const first = list[0];
    if (first) pr = { ...first, mergeCommit: first.mergeCommit?.oid ?? null };
  }
  prCache.set(record.id, { at: Date.now(), pr });
  return pr;
}

export function forgetPr(id: string) {
  prCache.delete(id);
}

export type CheckRun = {
  name: string;
  state: string;
  bucket: string;
  link: string;
};

export async function prChecks(record: PostRecord, pr: PrInfo) {
  // 검사가 진행 중이면 종료 코드가 0이 아니어도 결과는 나온다
  const result = await gh(
    ["pr", "checks", String(pr.number), "--json", "name,state,bucket,link"],
    record.worktree
  );
  try {
    return JSON.parse(result.stdout || "[]") as CheckRun[];
  } catch {
    return [];
  }
}

export async function deployRun(record: PostRecord, mergeCommit: string) {
  const result = await gh(
    [
      "run",
      "list",
      "--workflow",
      "deploy.yml",
      "--branch",
      "main",
      "--limit",
      "15",
      "--json",
      "databaseId,status,conclusion,headSha,url,createdAt",
    ],
    record.worktree
  );
  if (result.code !== 0) return null;
  const runs = JSON.parse(result.stdout || "[]") as {
    databaseId: number;
    status: string;
    conclusion: string;
    headSha: string;
    url: string;
    createdAt: string;
  }[];
  return runs.find(r => r.headSha === mergeCommit) ?? null;
}

const liveCache = new Map<string, { at: number; value: LiveInfo }>();

export type LiveInfo = {
  status: number | null;
  hasTitle: boolean;
  url: string;
};

export async function liveInfo(url: string, title: string): Promise<LiveInfo> {
  const cached = liveCache.get(url);
  if (cached && Date.now() - cached.at < 30_000) return cached.value;
  let value: LiveInfo = { status: null, hasTitle: false, url };
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "cache-control": "no-cache" },
    });
    const html = await response.text();
    value = {
      status: response.status,
      hasTitle: Boolean(title) && html.includes(title.replace(/&/g, "&amp;")),
      url,
    };
  } catch {
    // 연결 실패는 status null로 둔다
  }
  liveCache.set(url, { at: Date.now(), value });
  return value;
}

export async function branchState(record: PostRecord) {
  return {
    head: await headSha(record.worktree),
    ahead: await aheadOfRemote(record.worktree),
  };
}

/** 발행 시각을 지금(한국 시각)으로 맞추고 커밋한다. AGENTS.md: 합치기 직전 시각으로 쓴다 */
export async function setPubDatetimeNow(record: PostRecord) {
  const file = draftPath(record);
  const relative = file.slice(record.worktree.length + 1);
  // 수락하지 않은 제안이나 커밋하지 않은 수락분이 같은 파일에 있으면 함께 커밋되므로 멈춘다
  const dirty = await run("git", [
    "-C",
    record.worktree,
    "diff",
    "--quiet",
    "HEAD",
    "--",
    relative,
  ]);
  if (dirty.code !== 0)
    throw new Error(
      "원고에 커밋하지 않은 변경이 있습니다. 제안을 정리하고 커밋한 뒤 다시 누르세요."
    );
  const text = readFileSync(file, "utf8");
  const now = seoulIso();
  if (!/^pubDatetime:.*$/m.test(text))
    throw new Error("프런트매터에 pubDatetime 줄이 없습니다.");
  writeFileSync(file, text.replace(/^pubDatetime:.*$/m, `pubDatetime: ${now}`));
  await git(record.worktree, ["add", "--", relative]);
  await git(record.worktree, [
    "commit",
    "-m",
    "post: 발행 시각을 머지 직전으로 맞춘다",
    "--",
    relative,
  ]);
  return now;
}

export async function push(record: PostRecord) {
  await runOk(
    "git",
    ["-C", record.worktree, "push", "-u", "origin", record.branch],
    {
      timeoutMs: 120_000,
    }
  );
  forgetPr(record.id);
}

export async function openPr(
  record: PostRecord,
  input: { title: string; body: string }
) {
  await push(record);
  const existing = await prInfo(record, 0);
  if (existing && existing.state === "OPEN") return existing;
  const result = await gh(
    [
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      record.branch,
      "--title",
      input.title,
      "--body",
      input.body,
    ],
    record.worktree
  );
  if (result.code !== 0)
    throw new Error(`PR을 만들지 못했습니다: ${result.stderr.trim()}`);
  forgetPr(record.id);
  return prInfo(record, 0);
}

/** 화면에서 본 커밋 그대로일 때만 머지한다. 그사이 누가 push했으면 gh가 거절한다 */
export async function merge(record: PostRecord, expectedHead: string) {
  const pr = await prInfo(record, 0);
  if (!pr || pr.state !== "OPEN") throw new Error("열린 PR이 없습니다.");
  if (pr.headRefOid !== expectedHead)
    throw new Error(
      "화면에서 본 뒤 PR에 새 커밋이 올라왔습니다. 새로 불러와 다시 확인하세요."
    );
  const checks = await prChecks(record, pr);
  const blocking = checks.filter(
    c => c.bucket !== "pass" && c.bucket !== "skipping"
  );
  if (blocking.length)
    throw new Error(
      `통과하지 않은 검사가 있습니다: ${blocking.map(c => `${c.name}(${c.state})`).join(", ")}`
    );
  const result = await gh(
    [
      "pr",
      "merge",
      String(pr.number),
      "--merge",
      "--match-head-commit",
      expectedHead,
    ],
    record.worktree
  );
  if (result.code !== 0)
    throw new Error(`머지하지 못했습니다: ${result.stderr.trim()}`);
  forgetPr(record.id);
  return prInfo(record, 0);
}

export function prBodyTemplate(
  record: PostRecord,
  title: string,
  description: string
) {
  if (record.mode === "fix") {
    return [
      "## 변경",
      "",
      `- ${title}: `,
      "",
      "## 이유",
      "",
      "- ",
      "",
      "## 검증",
      "",
      "- 블로그 스튜디오 빠른 점검과 빌드 점검",
      "",
      "## 리뷰 포인트",
      "",
      "- ",
      "",
    ].join("\n");
  }
  return [
    "## 변경",
    "",
    `- 새 글: ${title}`,
    description ? `- 요약: ${description}` : "",
    "",
    "## 검증",
    "",
    "- 블로그 스튜디오 빠른 점검과 빌드 점검(메타 태그, 구조화 데이터, llms.txt, sitemap)",
    "",
    "## 리뷰 포인트",
    "",
    "- ",
    "",
  ]
    .filter(line => line !== null)
    .join("\n");
}
