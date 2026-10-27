import { existsSync } from "node:fs";
import path from "node:path";
import { run } from "./exec.ts";

// 글 worktree는 main에서 막 딴 폴더라 사이트 의존성이 없다. 미리보기와 빌드 점검은 물론 빠른 점검에도 필요하다.
// 빠른 점검이 불러오는 checkPosts.ts를 Vite가 변환할 때 tsconfig.json이 상속하는 astro/tsconfigs/strict를 찾는다

type Install = { ok: boolean; log: string };

const installing = new Map<string, Promise<Install>>();

export function hasSiteDeps(worktree: string) {
  return existsSync(path.join(worktree, "node_modules", ".bin", "astro"));
}

/** 의존성이 없으면 설치한다. 같은 worktree에 동시에 들어온 설치는 하나로 합친다 */
export function ensureSiteDeps(worktree: string): Promise<Install> {
  if (hasSiteDeps(worktree)) return Promise.resolve({ ok: true, log: "" });
  let job = installing.get(worktree);
  if (!job) {
    job = run("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], {
      cwd: worktree,
      timeoutMs: 10 * 60 * 1000,
    })
      .then(result => ({
        ok: result.code === 0,
        log: result.stdout + result.stderr,
      }))
      .finally(() => installing.delete(worktree));
    installing.set(worktree, job);
  }
  return job;
}
