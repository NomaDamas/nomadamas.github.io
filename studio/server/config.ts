import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STUDIO_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

/** 스튜디오를 실행한 블로그 저장소(또는 그 worktree)의 루트 */
export const REPO_ROOT = execFileSync(
  "git",
  ["-C", STUDIO_DIR, "rev-parse", "--show-toplevel"],
  { encoding: "utf8" }
).trim();

/** 로컬 상태 폴더. .gitignore에 있다 */
export const STATE_DIR = path.join(REPO_ROOT, ".studio");

export type AgentKind = "claude" | "codex";

export type Settings = {
  /** 글마다 <YYMMDD>-<slug> 작업 폴더(요청, 브리프, 근거 표, 캡처 원본)를 만들 곳 */
  workRoot: string;
  /** 글마다 만드는 블로그 저장소 worktree를 둘 곳 */
  worktreeRoot: string;
  /** 에이전트를 띄울 폴더. 비우면 작업 폴더가 든 git 저장소의 루트, 그것도 없으면 글 worktree */
  agentCwd: string;
  /** herdr 세션 이름. 비우면 herdr 기본 세션 */
  herdrSession: string;
  /** 새 글 폼에서 먼저 골라 둘 herdr 워크스페이스 id */
  herdrWorkspace: string;
  /** 새 글 폼에서 먼저 골라 둘 에이전트 */
  agentKind: AgentKind;
  port: number;
};

type SettingKey = keyof Settings;

const ENV_KEYS: Partial<Record<SettingKey, string>> = {
  workRoot: "STUDIO_WORK_ROOT",
  worktreeRoot: "STUDIO_WORKTREE_ROOT",
  agentCwd: "STUDIO_AGENT_CWD",
  herdrSession: "STUDIO_HERDR_SESSION",
  port: "STUDIO_PORT",
};

const DEFAULTS: Settings = {
  workRoot: path.join(STATE_DIR, "work"),
  worktreeRoot: path.join(STATE_DIR, "worktrees"),
  agentCwd: "",
  herdrSession: "",
  herdrWorkspace: "",
  agentKind: "claude",
  port: 4310,
};

const CONFIG_FILE = path.join(STATE_DIR, "config.json");

export function expandHome(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function readConfigFile(): Partial<Settings> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as Partial<Settings>;
  } catch {
    return {};
  }
}

/** 기본값 < .studio/config.json < 환경 변수 순서로 덮는다 */
export function loadSettings(): {
  settings: Settings;
  lockedByEnv: SettingKey[];
} {
  const file = readConfigFile();
  const merged: Settings = { ...DEFAULTS, ...file };
  const lockedByEnv: SettingKey[] = [];
  for (const [key, envName] of Object.entries(ENV_KEYS) as [
    SettingKey,
    string,
  ][]) {
    const value = process.env[envName];
    if (value === undefined || value === "") continue;
    lockedByEnv.push(key);
    if (key === "port") merged.port = Number(value);
    else (merged[key] as string) = value;
  }
  for (const key of ["workRoot", "worktreeRoot", "agentCwd"] as const) {
    if (merged[key]) merged[key] = path.resolve(expandHome(merged[key]));
  }
  if (merged.agentKind !== "codex") merged.agentKind = "claude";
  return { settings: merged, lockedByEnv };
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const current = readConfigFile();
  const next = { ...current };
  for (const key of [
    "workRoot",
    "worktreeRoot",
    "agentCwd",
    "herdrSession",
    "herdrWorkspace",
    "agentKind",
  ] as const) {
    if (patch[key] !== undefined) (next[key] as string) = String(patch[key]);
  }
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2) + "\n");
  return loadSettings().settings;
}

/** 블로그 주소. astro-paper.config.ts의 site.url과 같은 값을 문자열에서 읽는다 */
export function siteUrl(repoRoot = REPO_ROOT): string {
  try {
    const text = readFileSync(
      path.join(repoRoot, "astro-paper.config.ts"),
      "utf8"
    );
    const match = /url:\s*"(https?:\/\/[^"]+)"/.exec(text);
    if (match?.[1]) return match[1].replace(/\/$/, "");
  } catch {
    // 아래 기본값
  }
  return "";
}
