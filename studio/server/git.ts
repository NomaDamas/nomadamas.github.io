import { existsSync } from "node:fs";
import { run, runOk } from "./exec.ts";

// 한글 경로를 \353\270... 같은 8진수로 바꾸지 않게 한다
const GIT = ["-c", "core.quotePath=false"];

export function git(cwd: string, args: string[], input?: string) {
  return runOk("git", [...GIT, "-C", cwd, ...args], { input });
}

export function gitRaw(cwd: string, args: string[], input?: string) {
  return run("git", [...GIT, "-C", cwd, ...args], { input });
}

export async function toplevel(dir: string): Promise<string | null> {
  if (!existsSync(dir)) return null;
  const result = await gitRaw(dir, ["rev-parse", "--show-toplevel"]);
  return result.code === 0 ? result.stdout.trim() : null;
}

export async function branchExists(repo: string, branch: string) {
  const local = await gitRaw(repo, [
    "show-ref",
    "--verify",
    "--quiet",
    `refs/heads/${branch}`,
  ]);
  return local.code === 0;
}

export async function remoteBranchExists(repo: string, branch: string) {
  const result = await gitRaw(repo, [
    "ls-remote",
    "--exit-code",
    "--heads",
    "origin",
    branch,
  ]);
  return result.code === 0;
}

/** origin/main에서 새 브랜치를 따서 worktree를 만든다 */
export async function addWorktree(repo: string, dir: string, branch: string) {
  await git(repo, ["fetch", "origin", "main", "--quiet"]);
  await git(repo, ["worktree", "add", "-b", branch, dir, "origin/main"]);
}

/** 원격에 이미 있는 브랜치를 worktree로 가져온다(다른 기기에서 시작한 글) */
export async function addWorktreeFromRemote(
  repo: string,
  dir: string,
  branch: string
) {
  await git(repo, ["fetch", "origin", branch, "--quiet"]);
  await git(repo, ["worktree", "add", "-b", branch, dir, `origin/${branch}`]);
  await git(dir, ["branch", "--set-upstream-to", `origin/${branch}`]);
}

export async function headSha(dir: string) {
  return (await git(dir, ["rev-parse", "HEAD"])).trim();
}

export async function currentBranch(dir: string) {
  return (await git(dir, ["rev-parse", "--abbrev-ref", "HEAD"])).trim();
}

/** 원격 브랜치보다 앞선 커밋 수. 원격에 브랜치가 없으면 null */
export async function aheadOfRemote(dir: string): Promise<number | null> {
  const result = await gitRaw(dir, [
    "rev-list",
    "--count",
    "@{upstream}..HEAD",
  ]);
  if (result.code !== 0) return null;
  return Number(result.stdout.trim());
}

/** origin/main에 없는 이 브랜치의 커밋 */
export async function commitsSinceMain(dir: string) {
  const out = await git(dir, [
    "log",
    "--format=%H%x09%s%x09%cI",
    "origin/main..HEAD",
  ]);
  return out
    .split("\n")
    .filter(Boolean)
    .map(line => {
      const [sha = "", subject = "", date = ""] = line.split("\t");
      return { sha, subject, date };
    });
}

export async function stagedFiles(dir: string) {
  const out = await git(dir, ["diff", "--cached", "--name-status"]);
  return out
    .split("\n")
    .filter(Boolean)
    .map(line => {
      const [status = "", ...rest] = line.split("\t");
      return { status, path: rest.join("\t") };
    });
}
