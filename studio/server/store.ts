import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { STATE_DIR, type AgentKind } from "./config.ts";

// 글 목록은 .studio/state.json, 코멘트는 글의 작업 폴더 comments.json에 둔다.
// 코멘트를 작업 폴더에 두는 이유: 에이전트와 사람이 같은 파일을 보고, 스튜디오를 지워도 기록이 남는다.

export type AgentRecord = {
  kind: AgentKind;
  name: string;
  workspaceId: string;
  tabId: string;
  paneId: string;
  startedAt: string;
  /**
   * starting: 탭을 만들고 에이전트를 띄우는 중, ready: 지시문까지 보냄,
   * blocked: 에이전트 창에 확인 창(폴더 신뢰 등)이 떠 있어 사람이 답해야 함, error: 실패
   */
  status: "starting" | "ready" | "blocked" | "error";
  error?: string;
};

export type PostRecord = {
  id: string;
  slug: string;
  /** 새 글 폼이나 고치기 폼에 적은 가제. 원고의 title이 생기면 그것을 보여 준다 */
  title: string;
  mode: "new" | "fix";
  createdAt: string;
  branch: string;
  worktree: string;
  workDir: string;
  keyword: string;
  agent: AgentRecord | null;
  /** 승인한 brief.md의 해시. 승인 뒤 브리프가 바뀌면 승인은 풀린다 */
  briefApproval: { sha256: string; approvedAt: string } | null;
  /** 숨긴 글. 폴더와 브랜치는 그대로 남는다 */
  hidden?: boolean;
};

type State = { version: 1; posts: Record<string, PostRecord> };

const STATE_FILE = path.join(STATE_DIR, "state.json");

export function writeJsonAtomic(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + "\n");
  renameSync(temp, file);
}

function readState(): State {
  if (!existsSync(STATE_FILE)) return { version: 1, posts: {} };
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
  } catch {
    return { version: 1, posts: {} };
  }
}

export function listRecords(): PostRecord[] {
  return Object.values(readState().posts).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export function getRecord(id: string): PostRecord | null {
  return readState().posts[id] ?? null;
}

export function saveRecord(record: PostRecord) {
  const state = readState();
  state.posts[record.id] = record;
  writeJsonAtomic(STATE_FILE, state);
}

export function updateRecord(
  id: string,
  change: (record: PostRecord) => void
): PostRecord {
  const state = readState();
  const record = state.posts[id];
  if (!record) throw new Error(`글을 찾지 못했습니다: ${id}`);
  change(record);
  writeJsonAtomic(STATE_FILE, state);
  return record;
}

// ── 코멘트 ────────────────────────────────────────────────

export type Anchor =
  | { kind: "text"; quote: string; prefix: string; suffix: string }
  | { kind: "image"; src: string; alt: string }
  | { kind: "brief"; quote: string }
  | { kind: "post" };

export type Reply = {
  at: string;
  author: "person" | "agent";
  body: string;
};

export type Comment = {
  id: string;
  createdAt: string;
  /** agent면 에이전트가 사람에게 묻는 질문(cli.ts ask) */
  author: "person" | "agent";
  anchor: Anchor;
  body: string;
  status: "open" | "resolved";
  replies: Reply[];
  /** 에이전트에게 보냈는지. none은 에이전트가 없거나 보낼 필요가 없는 것 */
  delivery: "pending" | "sent" | "failed" | "none";
  deliveryError?: string;
};

type CommentFile = { comments: Comment[] };

function commentsFile(workDir: string) {
  return path.join(workDir, "comments.json");
}

export function readComments(workDir: string): Comment[] {
  const file = commentsFile(workDir);
  if (!existsSync(file)) return [];
  try {
    return (JSON.parse(readFileSync(file, "utf8")) as CommentFile).comments;
  } catch {
    return [];
  }
}

export function changeComments<T>(
  workDir: string,
  change: (comments: Comment[]) => T
): T {
  const comments = readComments(workDir);
  const result = change(comments);
  writeJsonAtomic(commentsFile(workDir), { comments });
  return result;
}

export function nextCommentId(comments: Comment[]) {
  const max = comments.reduce(
    (n, c) => Math.max(n, Number(c.id.replace(/^c/, "")) || 0),
    0
  );
  return `c${max + 1}`;
}
