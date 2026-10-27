import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { REPO_ROOT, type Settings } from "./config.ts";
import {
  addWorktree,
  addWorktreeFromRemote,
  branchExists,
  git,
  remoteBranchExists,
} from "./git.ts";
import { readComments, saveRecord, type PostRecord } from "./store.ts";

export const POSTS_DIR = "src/content/posts";
export const IMAGES_DIR = "src/assets/images";

/** 30분 동안 작업 폴더와 원고가 그대로면 멈춘 것으로 본다 */
export const STALL_MS = 30 * 60 * 1000;

export const STAGES = [
  { key: "new", label: "새 글" },
  { key: "brief", label: "브리프" },
  { key: "handson", label: "직접 써 보기" },
  { key: "draft", label: "원고" },
  { key: "checks", label: "점검" },
  { key: "publish", label: "발행" },
  { key: "after", label: "발행 뒤" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── 시각 ───────────────────────────────────────────────────

function seoulParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** 260927 같은 한국 날짜. 작업 폴더 이름의 접두사 */
export function yymmdd(date = new Date()) {
  const p = seoulParts(date);
  return `${p.year.slice(2)}${p.month}${p.day}`;
}

/** 프런트매터 pubDatetime에 쓰는 한국 시각. 시간대를 빼면 UTC로 읽힌다(AGENTS.md) */
export function seoulIso(date = new Date()) {
  const p = seoulParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+09:00`;
}

// ── 원고 ───────────────────────────────────────────────────

export type FrontMatter = {
  title?: string;
  description?: string;
  pubDatetime?: string;
  modDatetime?: string;
  draft?: string;
  tags?: string[];
  ogImage?: string;
};

/** 스튜디오가 보여 줄 만큼만 읽는다. 정확한 검사는 빌드(content.config.ts)가 한다 */
export function parseFrontMatter(text: string): {
  front: FrontMatter;
  body: string;
  bodyStartLine: number;
} {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return { front: {}, body: text, bodyStartLine: 1 };
  const end = lines.indexOf("---", 1);
  if (end < 0) return { front: {}, body: text, bodyStartLine: 1 };
  const front: FrontMatter = {};
  const record = front as Record<string, string | string[]>;
  let listKey: string | null = null;
  for (const line of lines.slice(1, end)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      (record[listKey] as string[]).push(unquote(item[1] ?? ""));
      continue;
    }
    const pair = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const [, key = "", raw = ""] = pair;
    const value = raw.replace(/\s+#.*$/, "").trim();
    if (value === "") {
      record[key] = [];
      listKey = key;
      continue;
    }
    listKey = null;
    if (value.startsWith("[") && value.endsWith("]")) {
      record[key] = value
        .slice(1, -1)
        .split(",")
        .map(v => unquote(v.trim()))
        .filter(Boolean);
    } else {
      record[key] = unquote(value);
    }
  }
  return {
    front,
    body: lines.slice(end + 1).join("\n"),
    bodyStartLine: end + 2,
  };
}

function unquote(value: string) {
  return value.replace(/^(["'])(.*)\1$/, "$2");
}

export function draftPath(record: PostRecord) {
  return path.join(record.worktree, POSTS_DIR, `${record.slug}.md`);
}

export function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function readIf(file: string) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function newestMtime(target: string, depth = 2): number {
  try {
    const info = statSync(target);
    if (!info.isDirectory() || depth === 0) return info.mtimeMs;
    let newest = info.mtimeMs;
    for (const name of readdirSync(target)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      newest = Math.max(
        newest,
        newestMtime(path.join(target, name), depth - 1)
      );
    }
    return newest;
  } catch {
    return 0;
  }
}

// ── 상태 판단 ──────────────────────────────────────────────

export type PrInfo = {
  number: number;
  url: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  headRefOid: string;
  mergedAt: string | null;
  mergeCommit: string | null;
  isDraft: boolean;
};

export type Facts = {
  request: string | null;
  brief: {
    text: string | null;
    sha256: string | null;
    approved: boolean;
    /** 승인한 뒤 브리프가 바뀌었다 */
    changedAfterApproval: boolean;
  };
  claims: boolean;
  captures: number;
  draft: { exists: boolean; front: FrontMatter };
  checks: { exists: boolean; stale: boolean; failed: number; warned: number };
  aiReview: boolean;
  share: boolean;
  lastActivity: number;
  openComments: number;
  agentQuestions: number;
};

export function gatherFacts(record: PostRecord): Facts {
  const request = readIf(path.join(record.workDir, "request.md"));
  const brief = readIf(path.join(record.workDir, "brief.md"));
  const briefSha = brief === null ? null : sha256(brief);
  const draftText = readIf(draftPath(record));
  const capturesDir = path.join(record.workDir, "captures");
  let captures = 0;
  try {
    captures = readdirSync(capturesDir).filter(n => !n.startsWith(".")).length;
  } catch {
    captures = 0;
  }
  const checksText = readIf(path.join(record.workDir, "checks.json"));
  let checks = { exists: false, stale: false, failed: 0, warned: 0 };
  if (checksText) {
    try {
      const data = JSON.parse(checksText) as {
        draftSha256?: string;
        items?: { level: string }[];
      };
      checks = {
        exists: true,
        stale:
          draftText === null || data.draftSha256 !== sha256(draftText ?? ""),
        failed: data.items?.filter(i => i.level === "fail").length ?? 0,
        warned: data.items?.filter(i => i.level === "warn").length ?? 0,
      };
    } catch {
      // 깨진 파일은 없는 것으로 본다
    }
  }
  const comments = readComments(record.workDir);
  const lastActivity = Math.max(
    newestMtime(record.workDir),
    newestMtime(draftPath(record), 0),
    newestMtime(path.join(record.worktree, IMAGES_DIR, record.slug), 1)
  );
  return {
    request,
    brief: {
      text: brief,
      sha256: briefSha,
      approved: briefSha !== null && record.briefApproval?.sha256 === briefSha,
      changedAfterApproval:
        record.briefApproval !== null &&
        briefSha !== null &&
        record.briefApproval.sha256 !== briefSha,
    },
    claims: existsSync(path.join(record.workDir, "claims.md")),
    captures,
    draft: {
      exists: draftText !== null,
      front: draftText ? parseFrontMatter(draftText).front : {},
    },
    checks,
    aiReview: existsSync(path.join(record.workDir, "ai-review.md")),
    share: existsSync(path.join(record.workDir, "share.md")),
    lastActivity,
    openComments: comments.filter(
      c => c.author === "person" && c.status === "open"
    ).length,
    agentQuestions: comments.filter(
      c =>
        c.author === "agent" &&
        c.status === "open" &&
        !c.replies.some(r => r.author === "person")
    ).length,
  };
}

export type Progress = {
  stage: StageKey;
  /** 다음에 움직일 쪽 */
  waitingOn: "person" | "agent" | "ci" | "none";
  note: string;
  stalled: boolean;
};

export function judge(
  record: PostRecord,
  facts: Facts,
  extra: {
    proposals: number;
    staged: number;
    pr: PrInfo | null;
    live: boolean | null;
  }
): Progress {
  const { pr } = extra;
  let stage: StageKey = "new";
  if (pr?.state === "MERGED") stage = "after";
  else if (pr?.state === "OPEN") stage = "publish";
  else if (facts.checks.exists && !facts.checks.stale) stage = "checks";
  else if (facts.draft.exists) stage = "draft";
  // 새 글은 브리프를 승인해야 다음 단계로 넘어간다. 그 전에 쌓인 근거 표는 단계로 치지 않는다
  else if (
    (facts.claims || facts.captures > 0) &&
    (record.mode === "fix" || facts.brief.approved)
  )
    stage = "handson";
  else if (facts.brief.text !== null) stage = "brief";

  let waitingOn: Progress["waitingOn"] = "agent";
  let note = "";
  if (facts.agentQuestions > 0) {
    waitingOn = "person";
    note = `에이전트 질문 ${facts.agentQuestions}건에 답해 주세요`;
  } else if (stage === "after") {
    waitingOn = "none";
    note =
      extra.live === true
        ? "사이트에 올라갔습니다"
        : "배포와 사이트 반영을 기다립니다";
  } else if (stage === "publish") {
    waitingOn = extra.proposals > 0 ? "person" : "ci";
    note =
      extra.proposals > 0
        ? `PR이 열린 뒤 고친 제안 ${extra.proposals}건이 있습니다`
        : "PR 검사를 보고 머지하면 발행됩니다";
  } else if (extra.proposals > 0) {
    waitingOn = "person";
    note = `에이전트가 고친 제안 ${extra.proposals}건을 검토해 주세요`;
  } else if (facts.openComments > 0) {
    waitingOn = "agent";
    note = `코멘트 ${facts.openComments}건을 반영하는 중`;
  } else if (stage === "brief" && !facts.brief.approved) {
    waitingOn = "person";
    note = facts.brief.changedAfterApproval
      ? "승인한 뒤 브리프가 바뀌었습니다. 다시 확인해 주세요"
      : "브리프를 확인하고 승인해 주세요";
  } else if (stage === "new") {
    note =
      record.mode === "fix"
        ? "고칠 곳을 코멘트로 남기거나 에이전트에게 맡기세요"
        : "에이전트가 브리프를 쓰는 중";
  } else if (stage === "brief") {
    note = "브리프 승인됨. 에이전트가 직접 써 보는 중";
  } else if (stage === "handson") {
    note = "에이전트가 직접 써 보며 근거와 캡처를 모으는 중";
  } else if (stage === "draft") {
    if (extra.staged > 0) {
      waitingOn = "person";
      note = "수락한 변경을 커밋해 주세요";
    } else {
      waitingOn = "person";
      note = "미리보기를 읽고 코멘트를 남기거나 점검을 돌리세요";
    }
  } else if (stage === "checks") {
    waitingOn = "person";
    note =
      facts.checks.failed > 0
        ? `점검 실패 ${facts.checks.failed}건`
        : "점검을 통과했습니다. 발행 탭에서 PR을 여세요";
  }
  if (
    waitingOn === "agent" &&
    (!record.agent || record.agent.status === "error")
  ) {
    waitingOn = "person";
    note = record.agent
      ? "에이전트를 띄우지 못했습니다. 다시 띄워 주세요"
      : "에이전트를 띄우면 이어서 진행합니다";
  }
  const stalled =
    waitingOn === "agent" && Date.now() - facts.lastActivity > STALL_MS;
  return { stage, waitingOn, note, stalled };
}

// ── 만들기 ─────────────────────────────────────────────────

export type NewPostInput = {
  slug: string;
  title: string;
  audience: string;
  postType: string;
  keyword: string;
  references: string;
  notes: string;
};

function assertSlug(slug: string) {
  if (!SLUG.test(slug))
    throw new Error(
      "주소(slug)는 영어 소문자, 숫자, 하이픈만 씁니다. 예: k-skill-v2"
    );
}

async function existsOnMain(slug: string) {
  const result = await git(REPO_ROOT, [
    "ls-tree",
    "--name-only",
    "origin/main",
    `${POSTS_DIR}/`,
  ]);
  return result.split("\n").some(line => line === `${POSTS_DIR}/${slug}.md`);
}

function requestMarkdown(input: NewPostInput) {
  const rows = [
    `# 새 글 요청: ${input.title || input.slug}`,
    "",
    "블로그 스튜디오의 새 글 폼에 사람이 적은 내용이다. 빈 칸은 에이전트가 브리프에서 제안한다.",
    "",
    `- 주소(slug): \`${input.slug}\``,
    `- 가제: ${input.title || "(비움)"}`,
    `- 독자: ${input.audience || "(비움)"}`,
    `- 글 유형: ${input.postType || "(비움)"}`,
    `- 검색 키워드: ${input.keyword || "(비움)"}`,
    "",
    "## 참고 자료",
    "",
    input.references.trim() || "(없음)",
    "",
    "## 메모",
    "",
    input.notes.trim() || "(없음)",
    "",
  ];
  return rows.join("\n");
}

export async function createPost(
  settings: Settings,
  input: NewPostInput
): Promise<PostRecord> {
  assertSlug(input.slug);
  const id = `post-${input.slug}`;
  const branch = `post/${input.slug}`;
  await git(REPO_ROOT, ["fetch", "origin", "main", "--quiet"]);
  if (await existsOnMain(input.slug))
    throw new Error(
      `이미 발행된 글입니다: ${input.slug}. 홈의 "발행된 글 고치기"를 쓰세요.`
    );
  if (await branchExists(REPO_ROOT, branch))
    throw new Error(`브랜치 ${branch}가 이미 로컬에 있습니다.`);
  const worktree = path.join(settings.worktreeRoot, "post", input.slug);
  if (existsSync(worktree))
    throw new Error(`worktree 폴더가 이미 있습니다: ${worktree}`);
  const workDir = path.join(settings.workRoot, `${yymmdd()}-${input.slug}`);
  if (await remoteBranchExists(REPO_ROOT, branch)) {
    await addWorktreeFromRemote(REPO_ROOT, worktree, branch);
  } else {
    await addWorktree(REPO_ROOT, worktree, branch);
  }
  mkdirSync(workDir, { recursive: true });
  const requestFile = path.join(workDir, "request.md");
  if (!existsSync(requestFile))
    writeFileSync(requestFile, requestMarkdown(input));
  const record: PostRecord = {
    id,
    slug: input.slug,
    title: input.title || input.slug,
    mode: "new",
    createdAt: new Date().toISOString(),
    branch,
    worktree,
    workDir,
    keyword: input.keyword,
    agent: null,
    briefApproval: null,
  };
  saveRecord(record);
  return record;
}

export type PublishedPost = {
  slug: string;
  title: string;
  pubDatetime: string;
};

export async function listPublished(): Promise<PublishedPost[]> {
  await git(REPO_ROOT, ["fetch", "origin", "main", "--quiet"]);
  const names = (
    await git(REPO_ROOT, [
      "ls-tree",
      "--name-only",
      "origin/main",
      `${POSTS_DIR}/`,
    ])
  )
    .split("\n")
    .filter(name => /\.md$/.test(name) && !path.basename(name).startsWith("_"));
  const posts: PublishedPost[] = [];
  for (const name of names) {
    const text = await git(REPO_ROOT, ["show", `origin/main:${name}`]);
    const { front } = parseFrontMatter(text);
    if (front.draft === "true") continue;
    posts.push({
      slug: path.basename(name, ".md"),
      title: front.title ?? path.basename(name, ".md"),
      pubDatetime: front.pubDatetime ?? "",
    });
  }
  return posts.sort((a, b) => b.pubDatetime.localeCompare(a.pubDatetime));
}

export async function createFix(
  settings: Settings,
  input: { slug: string; notes: string }
): Promise<PostRecord> {
  assertSlug(input.slug);
  await git(REPO_ROOT, ["fetch", "origin", "main", "--quiet"]);
  if (!(await existsOnMain(input.slug)))
    throw new Error(`main에 없는 글입니다: ${input.slug}`);
  const date = yymmdd();
  let suffix = date;
  let n = 2;
  while (await branchExists(REPO_ROOT, `fix/${input.slug}-${suffix}`)) {
    suffix = `${date}-${n++}`;
  }
  const branch = `fix/${input.slug}-${suffix}`;
  const id = `fix-${input.slug}-${suffix}`;
  const worktree = path.join(
    settings.worktreeRoot,
    "fix",
    `${input.slug}-${suffix}`
  );
  const workDir = path.join(settings.workRoot, `${date}-${input.slug}-fix`);
  await addWorktree(REPO_ROOT, worktree, branch);
  mkdirSync(workDir, { recursive: true });
  const { front } = parseFrontMatter(
    readFileSync(path.join(worktree, POSTS_DIR, `${input.slug}.md`), "utf8")
  );
  const requestFile = path.join(workDir, "request.md");
  if (!existsSync(requestFile)) {
    writeFileSync(
      requestFile,
      [
        `# 발행된 글 고치기: ${front.title ?? input.slug}`,
        "",
        "블로그 스튜디오의 고치기 폼에 사람이 적은 내용이다.",
        "",
        `- 주소(slug): \`${input.slug}\``,
        `- 브랜치: \`${branch}\``,
        "",
        "## 고칠 것",
        "",
        input.notes.trim() || "(비움. 스튜디오 코멘트로 전달한다)",
        "",
      ].join("\n")
    );
  }
  const record: PostRecord = {
    id,
    slug: input.slug,
    title: front.title ?? input.slug,
    mode: "fix",
    createdAt: new Date().toISOString(),
    branch,
    worktree,
    workDir,
    keyword: "",
    agent: null,
    briefApproval: null,
  };
  saveRecord(record);
  return record;
}
