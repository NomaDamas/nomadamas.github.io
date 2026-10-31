import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { git, gitRaw } from "./git.ts";

// 에이전트가 고친 내용은 커밋되지 않은 변경으로 남는다. 스튜디오는 그 변경을 덩어리(hunk)로 쪼개
// 제안으로 보여 주고, 사람이 수락하면 stage, 거절하면 그 덩어리만 되돌린다. 커밋은 사람만 한다.
// 비교 기준은 인덱스다. 수락한 덩어리는 인덱스에 들어가 제안 목록에서 빠지고 "커밋할 변경"으로 옮겨진다.

export type HunkLine = { kind: "+" | "-" | " " | "\\"; text: string };

export type Proposal =
  | {
      id: string;
      type: "hunk";
      path: string;
      header: string;
      lines: HunkLine[];
    }
  | {
      id: string;
      type: "file";
      path: string;
      change: "new" | "delete" | "binary" | "mode";
      size: number | null;
    };

type ParsedFile = {
  path: string;
  binary: boolean;
  deleted: boolean;
  created: boolean;
  modeOnly: boolean;
  hunks: { header: string; raw: string[] }[];
};

function hash(text: string) {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}

/** `diff --git a/P b/P`에서 P. 이름 바꾸기를 끄고 비교하므로 양쪽 경로가 같다 */
function pathFromHeader(line: string) {
  const rest = line.slice("diff --git ".length);
  const size = (rest.length - 5) / 2;
  return rest.slice(2, 2 + size);
}

export function parseDiff(text: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  let file: ParsedFile | null = null;
  let hunk: { header: string; raw: string[] } | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      file = {
        path: pathFromHeader(line),
        binary: false,
        deleted: false,
        created: false,
        modeOnly: false,
        hunks: [],
      };
      files.push(file);
      hunk = null;
      continue;
    }
    if (!file) continue;
    if (line.startsWith("@@")) {
      hunk = { header: line, raw: [] };
      file.hunks.push(hunk);
      continue;
    }
    if (hunk && /^[ +\-\\]/.test(line)) {
      hunk.raw.push(line);
      continue;
    }
    if (line.startsWith("Binary files")) file.binary = true;
    else if (line.startsWith("deleted file mode")) file.deleted = true;
    else if (line.startsWith("new file mode")) file.created = true;
    else if (line.startsWith("old mode")) file.modeOnly = true;
  }
  for (const f of files) {
    if (f.hunks.length > 0) f.modeOnly = false;
  }
  return files;
}

function filePatch(filePath: string, header: string, raw: string[]) {
  return [
    `diff --git a/${filePath} b/${filePath}`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    header,
    ...raw,
    "",
  ].join("\n");
}

function fileSize(dir: string, filePath: string) {
  try {
    return statSync(path.join(dir, filePath)).size;
  } catch {
    return null;
  }
}

type Located =
  { proposal: Proposal; patch: string } | { proposal: Proposal; patch: null };

async function locate(dir: string): Promise<Located[]> {
  const diff = await git(dir, [
    "diff",
    "--no-color",
    "--no-ext-diff",
    "--no-renames",
    "-U3",
  ]);
  const located: Located[] = [];
  for (const file of parseDiff(diff)) {
    if (file.binary || file.deleted || file.created || file.modeOnly) {
      const change = file.deleted
        ? "delete"
        : file.binary
          ? "binary"
          : file.created
            ? "new"
            : "mode";
      located.push({
        proposal: {
          id: hash(`${change}\0${file.path}\0${fileSize(dir, file.path)}`),
          type: "file",
          path: file.path,
          change,
          size: fileSize(dir, file.path),
        },
        patch: null,
      });
      continue;
    }
    const seen = new Map<string, number>();
    for (const h of file.hunks) {
      const body = h.raw.join("\n");
      const n = seen.get(body) ?? 0;
      seen.set(body, n + 1);
      located.push({
        proposal: {
          id: hash(`${file.path}\0${body}\0${n}`),
          type: "hunk",
          path: file.path,
          header: h.header,
          lines: h.raw.map(raw => ({
            kind: raw[0] as HunkLine["kind"],
            text: raw.slice(1),
          })),
        },
        patch: filePatch(file.path, h.header, h.raw),
      });
    }
  }
  const untracked = await git(dir, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  for (const filePath of untracked.split("\0").filter(Boolean)) {
    const size = fileSize(dir, filePath);
    let mtime = 0;
    try {
      mtime = statSync(path.join(dir, filePath)).mtimeMs;
    } catch {
      // 지워지는 중인 파일
    }
    located.push({
      proposal: {
        id: hash(`new\0${filePath}\0${size}\0${mtime}`),
        type: "file",
        path: filePath,
        change: "new",
        size,
      },
      patch: null,
    });
  }
  return located;
}

export async function listProposals(dir: string): Promise<Proposal[]> {
  return (await locate(dir)).map(item => item.proposal);
}

function stamp() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
}

/** 거절한 변경을 지우지 않고 보관한다. 실수로 거절해도 이 폴더에서 되살린다 */
function keepRejected(keepDir: string, name: string, content: string | null) {
  mkdirSync(keepDir, { recursive: true });
  const safe = name.replace(/[^\w.-]+/g, "_");
  const target = path.join(keepDir, `${stamp()}-${safe}`);
  if (content !== null) writeFileSync(target, content);
  return target;
}

export class StaleProposalError extends Error {
  constructor() {
    super(
      "그사이 파일이 바뀌어 이 제안을 찾지 못했습니다. 목록을 새로 불러온 뒤 다시 고르세요."
    );
  }
}

export async function decide(
  dir: string,
  ids: string[],
  verdict: "accept" | "reject",
  keepDir: string
) {
  const located = await locate(dir);
  const done: string[] = [];
  for (const id of ids) {
    const item = located.find(entry => entry.proposal.id === id);
    if (!item) throw new StaleProposalError();
    const { proposal, patch } = item;
    if (verdict === "accept") {
      if (patch) await git(dir, ["apply", "--cached", "-"], patch);
      else await git(dir, ["add", "-A", "--", proposal.path]);
    } else if (patch) {
      keepRejected(keepDir, `${proposal.path}.patch`, patch);
      await git(dir, ["apply", "-R", "-"], patch);
    } else if (proposal.type === "file" && proposal.change === "new") {
      const source = path.join(dir, proposal.path);
      const target = keepRejected(keepDir, path.basename(proposal.path), null);
      try {
        renameSync(source, target);
      } catch {
        // 다른 디스크면 옮기지 못해 복사 후 지운다
        copyFileSync(source, target);
        unlinkSync(source);
      }
    } else {
      const source = path.join(dir, proposal.path);
      if (existsSync(source)) {
        const target = keepRejected(
          keepDir,
          path.basename(proposal.path),
          null
        );
        copyFileSync(source, target);
      }
      await git(dir, ["checkout", "--", proposal.path]);
    }
    done.push(id);
  }
  return done;
}

/** 수락을 취소한다. 그 파일의 stage만 풀고 작업 트리는 그대로 둔다 */
export async function unstage(dir: string, filePath: string) {
  const result = await gitRaw(dir, ["restore", "--staged", "--", filePath]);
  if (result.code !== 0) throw new Error(result.stderr.trim());
}
