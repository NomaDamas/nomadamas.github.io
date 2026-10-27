import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { getRequestListener } from "@hono/node-server";
import react from "@vitejs/plugin-react";
import { createServer as createVite } from "vite";
import { createApi } from "./api.ts";
import { loadSettings, REPO_ROOT, STATE_DIR, STUDIO_DIR } from "./config.ts";
import { stopAllPreviews } from "./preview.ts";

// pnpm studio. API(Hono)와 화면(Vite + React)을 한 프로세스, 한 포트에서 낸다.
// 로컬 도구라 127.0.0.1에만 묶는다.

const { settings } = loadSettings();
const host = "127.0.0.1";
const origin = `http://${host}:${settings.port}`;

const server = http.createServer();
const vite = await createVite({
  configFile: false,
  root: path.join(STUDIO_DIR, "ui"),
  plugins: [react()],
  appType: "spa",
  clearScreen: false,
  logLevel: "warn",
  server: { middlewareMode: true, hmr: { server } },
});

const api = getRequestListener(createApi({ vite, origin: () => origin }).fetch);
const bridgeFile = path.join(STUDIO_DIR, "bridge", "bridge.js");

server.on("request", (req, res) => {
  const url = req.url ?? "/";
  // 사람 확인과 미리보기 메시지가 출처(127.0.0.1)를 따지므로 localhost로 열면 한 주소로 보낸다
  if (req.headers.host === `localhost:${settings.port}`) {
    res.writeHead(302, { location: `${origin}${url}` });
    res.end();
    return;
  }
  if (url.startsWith("/api/")) {
    void api(req, res);
    return;
  }
  if (url.startsWith("/bridge.js")) {
    res.writeHead(200, {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(
      readFileSync(bridgeFile, "utf8").replaceAll("__STUDIO_ORIGIN__", origin)
    );
    return;
  }
  vite.middlewares(req, res);
});

const runtimeFile = path.join(STATE_DIR, "runtime.json");

server.on("error", error => {
  console.error(`스튜디오를 열지 못했습니다: ${error.message}`);
  process.exit(1);
});

server.listen(settings.port, host, () => {
  mkdirSync(STATE_DIR, { recursive: true });
  // 에이전트의 cli.ts가 이 파일에서 주소를 찾는다
  writeFileSync(
    runtimeFile,
    JSON.stringify({ url: origin, pid: process.pid }, null, 2) + "\n"
  );
  console.log(`블로그 스튜디오: ${origin}`);
  console.log(`저장소: ${REPO_ROOT}`);
  console.log(`작업 폴더: ${settings.workRoot}`);
  console.log(`글 worktree: ${settings.worktreeRoot}`);
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  stopAllPreviews();
  rmSync(runtimeFile, { force: true });
  void vite.close();
  server.close();
  setTimeout(() => process.exit(0), 300);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
