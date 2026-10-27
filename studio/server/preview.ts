import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { run } from "./exec.ts";
import type { PostRecord } from "./store.ts";

// 글 worktree마다 Astro 개발 서버를 띄우고, 그 앞에 작은 프록시를 둔다.
// 프록시는 HTML 응답에 bridge.js 한 줄을 끼워 넣는다. 그래서 사이트 설정(astro.config.ts)을 고치지 않고도
// 미리보기에서 고른 문장이 스튜디오로 전달된다. 미리보기는 다른 포트라 스튜디오 API를 부를 수 없다.

type Preview = {
  status: "installing" | "starting" | "running" | "error" | "stopped";
  astroPort: number;
  proxyPort: number;
  log: string[];
  error?: string;
  child?: ChildProcess;
  proxy?: http.Server;
};

const previews = new Map<string, Preview>();

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function remember(preview: Preview, text: string) {
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    // ANSI 색 코드를 걷어 화면에 그대로 보이게 한다
    preview.log.push(line.replace(/\x1b\[[0-9;]*m/g, ""));
  }
  if (preview.log.length > 300) preview.log.splice(0, preview.log.length - 300);
}

async function waitForHttp(port: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>(resolve => {
      const req = http.get({ host: "127.0.0.1", port, path: "/" }, res => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ok) return true;
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  return false;
}

function createProxy(upstreamPort: number, bridgeTag: string) {
  const server = http.createServer((req, res) => {
    const headers = { ...req.headers };
    headers.host = `127.0.0.1:${upstreamPort}`;
    // 압축된 HTML에는 스크립트를 끼울 수 없다
    headers["accept-encoding"] = "identity";
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: upstreamPort,
        method: req.method,
        path: req.url,
        headers,
      },
      upstreamRes => {
        const type = String(upstreamRes.headers["content-type"] ?? "");
        if (!type.includes("text/html")) {
          res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
          upstreamRes.pipe(res);
          return;
        }
        const chunks: Buffer[] = [];
        upstreamRes.on("data", chunk => chunks.push(chunk as Buffer));
        upstreamRes.on("end", () => {
          let html = Buffer.concat(chunks).toString("utf8");
          html = html.includes("</head>")
            ? html.replace("</head>", `${bridgeTag}</head>`)
            : bridgeTag + html;
          const outHeaders = { ...upstreamRes.headers };
          delete outHeaders["content-length"];
          delete outHeaders["content-encoding"];
          res.writeHead(upstreamRes.statusCode ?? 200, outHeaders);
          res.end(html);
        });
      }
    );
    upstream.on("error", error => {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end(`미리보기 서버에 닿지 못했습니다: ${error.message}`);
    });
    req.pipe(upstream);
  });
  // Vite의 HMR 웹소켓을 그대로 넘긴다. 원고를 고치면 미리보기가 새로 고쳐진다
  server.on("upgrade", (req, socket, head) => {
    const upstream = net.connect(upstreamPort, "127.0.0.1", () => {
      let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const key = req.rawHeaders[i] ?? "";
        const value = req.rawHeaders[i + 1] ?? "";
        raw +=
          key.toLowerCase() === "host"
            ? `Host: 127.0.0.1:${upstreamPort}\r\n`
            : `${key}: ${value}\r\n`;
      }
      upstream.write(`${raw}\r\n`);
      if (head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });
  return server;
}

export function previewInfo(id: string, slug: string) {
  const preview = previews.get(id);
  if (!preview) return { status: "stopped" as const, url: null, log: [] };
  return {
    status: preview.status,
    url:
      preview.status === "running"
        ? `http://127.0.0.1:${preview.proxyPort}/posts/${slug}/`
        : null,
    log: preview.log.slice(-40),
    error: preview.error,
  };
}

export function startPreview(record: PostRecord, studioOrigin: string) {
  const existing = previews.get(record.id);
  if (
    existing &&
    ["installing", "starting", "running"].includes(existing.status)
  )
    return;
  const preview: Preview = {
    status: "installing",
    astroPort: 0,
    proxyPort: 0,
    log: [],
  };
  previews.set(record.id, preview);
  void (async () => {
    try {
      const wt = record.worktree;
      if (!existsSync(path.join(wt, "node_modules", ".bin", "astro"))) {
        remember(preview, "의존성을 설치합니다(pnpm install)…");
        const install = await run(
          "pnpm",
          ["install", "--frozen-lockfile", "--prefer-offline"],
          { cwd: wt, timeoutMs: 10 * 60 * 1000 }
        );
        remember(preview, install.stdout + install.stderr);
        if (install.code !== 0) throw new Error("pnpm install이 실패했습니다");
      }
      preview.status = "starting";
      const astro = path.join(wt, "node_modules", ".bin", "astro");
      // 스튜디오가 죽으면서 남긴 개발 서버가 있으면 먼저 끈다
      await run(astro, ["dev", "stop"], { cwd: wt, timeoutMs: 15_000 });
      preview.astroPort = await freePort();
      // Astro 7은 에이전트 안에서 실행되면 개발 서버를 떼어 내 백그라운드로 돌린다. 그러면 스튜디오가
      // 프로세스를 들고 있지 못해 끌 수 없다. Astro가 백그라운드 자식에게 주는 이 값을 똑같이 주면 앞에서 돈다
      const child = spawn(
        astro,
        ["dev", "--port", String(preview.astroPort), "--host", "127.0.0.1"],
        {
          cwd: wt,
          env: { ...process.env, BROWSER: "none", ASTRO_DEV_BACKGROUND: "1" },
          stdio: "pipe",
        }
      );
      preview.child = child;
      child.stdout?.on("data", chunk => remember(preview, String(chunk)));
      child.stderr?.on("data", chunk => remember(preview, String(chunk)));
      child.on("exit", code => {
        if (preview.status !== "stopped") {
          preview.status = "error";
          preview.error = `Astro 개발 서버가 끝났습니다(종료 코드 ${code})`;
          preview.proxy?.close();
        }
      });
      if (!(await waitForHttp(preview.astroPort, 120_000)))
        throw new Error("Astro 개발 서버가 2분 안에 뜨지 않았습니다");
      preview.proxyPort = await freePort();
      const tag = `<script src="${studioOrigin}/bridge.js" defer></script>`;
      const proxy = createProxy(preview.astroPort, tag);
      await new Promise<void>(resolve =>
        proxy.listen(preview.proxyPort, "127.0.0.1", resolve)
      );
      preview.proxy = proxy;
      if (preview.status === "starting") preview.status = "running";
    } catch (error) {
      preview.status = "error";
      preview.error = error instanceof Error ? error.message : String(error);
      preview.child?.kill("SIGTERM");
    }
  })();
}

export function stopPreview(id: string) {
  const preview = previews.get(id);
  if (!preview) return;
  preview.status = "stopped";
  preview.child?.kill("SIGTERM");
  preview.proxy?.close();
  previews.delete(id);
}

export function stopAllPreviews() {
  for (const id of [...previews.keys()]) stopPreview(id);
}
