import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";

export type RunResult = { code: number; stdout: string; stderr: string };

export type RunOptions = {
  cwd?: string;
  input?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

export class CommandError extends Error {
  result: RunResult;
  constructor(command: string, result: RunResult) {
    const detail = (result.stderr || result.stdout).trim().slice(0, 1500);
    super(`${command} 실패(${result.code}): ${detail}`);
    this.result = result;
  }
}

export function run(
  cmd: string,
  args: string[],
  options: RunOptions = {}
): Promise<RunResult> {
  return new Promise(resolve => {
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = options.timeoutMs
      ? setTimeout(() => child.kill("SIGTERM"), options.timeoutMs)
      : undefined;
    child.stdout.on("data", chunk => (stdout += chunk));
    child.stderr.on("data", chunk => (stderr += chunk));
    child.on("error", error => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + String(error) });
    });
    child.on("close", code => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
    child.stdin.end(options.input ?? "");
  });
}

export async function runOk(
  cmd: string,
  args: string[],
  options: RunOptions = {}
): Promise<string> {
  const result = await run(cmd, args, options);
  if (result.code !== 0)
    throw new CommandError(`${cmd} ${args.slice(0, 3).join(" ")}`, result);
  return result.stdout;
}

/** PATH에서 실행 파일을 찾는다. 없으면 null */
export function which(name: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // 다음 PATH 항목
    }
  }
  return null;
}
