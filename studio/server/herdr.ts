import { run, which } from "./exec.ts";
import type { AgentKind, Settings } from "./config.ts";

// herdr CLI를 감싼다. 스튜디오는 새 글마다 탭을 하나 만들어 에이전트를 띄우고, 그 탭에만 입력한다.
// 사용자가 이미 쓰고 있는 탭과 pane에는 입력하지 않는다. 대상은 스튜디오가 기록한 pane id로만 고른다.

export type HerdrPane = {
  pane_id: string;
  tab_id: string;
  workspace_id: string;
  agent?: string | null;
  agent_status?: string | null;
  cwd?: string | null;
};

export class HerdrError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function prefix(settings: Settings) {
  return settings.herdrSession ? ["--session", settings.herdrSession] : [];
}

async function call(
  settings: Settings,
  args: string[],
  timeoutMs = 30_000
): Promise<Record<string, unknown>> {
  const bin = which("herdr");
  if (!bin) throw new HerdrError("missing", "herdr가 PATH에 없습니다.");
  const result = await run(bin, [...prefix(settings), ...args], {
    timeoutMs: timeoutMs + 5_000,
  });
  const raw =
    result.code === 0 ? result.stdout : result.stderr || result.stdout;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    if (result.code !== 0)
      throw new HerdrError("cli_error", raw.trim().slice(0, 500));
    return {};
  }
  const error = parsed.error as { code?: string; message?: string } | undefined;
  if (result.code !== 0 || error) {
    throw new HerdrError(
      error?.code ?? "cli_error",
      error?.message ?? raw.trim().slice(0, 500)
    );
  }
  return (parsed.result as Record<string, unknown>) ?? parsed;
}

export function available() {
  return which("herdr") !== null;
}

export async function listWorkspaces(settings: Settings) {
  const result = await call(settings, ["workspace", "list"]);
  const list = (result.workspaces as Record<string, unknown>[]) ?? [];
  return list.map(w => ({
    id: String(w.workspace_id),
    label: String(w.label ?? ""),
    number: Number(w.number ?? 0),
  }));
}

export async function findPane(
  settings: Settings,
  paneId: string
): Promise<HerdrPane | null> {
  const result = await call(settings, ["api", "snapshot"]);
  const snapshot = (result.snapshot ?? result) as { panes?: HerdrPane[] };
  return snapshot.panes?.find(p => p.pane_id === paneId) ?? null;
}

export async function createTab(
  settings: Settings,
  options: {
    workspaceId: string;
    cwd: string;
    label: string;
    env: Record<string, string>;
  }
) {
  const args = [
    "tab",
    "create",
    "--workspace",
    options.workspaceId,
    "--cwd",
    options.cwd,
    "--label",
    options.label,
    "--no-focus",
  ];
  for (const [key, value] of Object.entries(options.env)) {
    args.push("--env", `${key}=${value}`);
  }
  const result = await call(settings, args);
  const tab = result.tab as { tab_id: string };
  const pane = result.root_pane as { pane_id: string };
  return { tabId: tab.tab_id, paneId: pane.pane_id };
}

/** 새 탭의 셸이 프롬프트를 그릴 때까지 기다린다. agent start는 셸 프롬프트에서만 된다 */
async function waitForShell(settings: Settings, paneId: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const bin = which("herdr");
    if (!bin) break;
    const screen = await run(bin, [
      ...prefix(settings),
      "pane",
      "read",
      paneId,
      "--source",
      "visible",
    ]);
    if (screen.code === 0 && screen.stdout.trim()) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

export async function startAgent(
  settings: Settings,
  options: { name: string; kind: AgentKind; paneId: string; args: string[] }
) {
  await waitForShell(settings, options.paneId);
  const args = [
    "agent",
    "start",
    options.name,
    "--kind",
    options.kind,
    "--pane",
    options.paneId,
    "--timeout",
    "90000",
  ];
  if (options.args.length) args.push("--", ...options.args);
  await call(settings, args, 90_000);
}

/** 프롬프트를 넣고 에이전트가 받아 일을 시작한 것까지만 확인한다. 끝날 때까지 기다리지 않는다 */
export async function prompt(settings: Settings, paneId: string, text: string) {
  const result = await call(
    settings,
    [
      "agent",
      "prompt",
      paneId,
      text,
      "--wait",
      "--until",
      "working",
      "--until",
      "blocked",
      "--until",
      "done",
      "--until",
      "idle",
      "--timeout",
      "20000",
    ],
    20_000
  );
  const agent = result.agent as { agent_status?: string } | undefined;
  return agent?.agent_status ?? "unknown";
}

export async function focusTab(settings: Settings, tabId: string) {
  await call(settings, ["tab", "focus", tabId]);
}

export async function closeTab(settings: Settings, tabId: string) {
  await call(settings, ["tab", "close", tabId]);
}
