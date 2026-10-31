import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Hono, type Context, type Next } from "hono";
import type { ViteDevServer } from "vite";
import {
  loadSettings,
  REPO_ROOT,
  saveSettings,
  siteUrl,
  STATE_DIR,
  STUDIO_DIR,
  type AgentKind,
} from "./config.ts";
import { which } from "./exec.ts";
import { git, stagedFiles, toplevel } from "./git.ts";
import * as herdr from "./herdr.ts";
import {
  decide,
  listProposals,
  StaleProposalError,
  unstage,
} from "./changes.ts";
import {
  agentAlive,
  agentCwd,
  deliverPending,
  launchAgent,
  sendToAgent,
} from "./agent.ts";
import {
  createFix,
  createPost,
  gatherFacts,
  judge,
  listPublished,
  sha256,
  STAGES,
  type NewPostInput,
} from "./posts.ts";
import { previewInfo, startPreview, stopPreview } from "./preview.ts";
import {
  buildStatus,
  metaItems,
  quickChecks,
  readChecks,
  startBuild,
} from "./checks.ts";
import {
  branchState,
  deployRun,
  liveInfo,
  merge,
  openPr,
  prBodyTemplate,
  prChecks,
  prInfo,
  push,
  setPubDatetimeNow,
} from "./publish.ts";
import {
  changeComments,
  getRecord,
  listRecords,
  nextCommentId,
  readComments,
  updateRecord,
  type Anchor,
  type PostRecord,
} from "./store.ts";

type Deps = { vite: ViteDevServer; origin: () => string };

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function inside(root: string, relative: string) {
  const target = path.resolve(root, relative);
  return target.startsWith(root + path.sep) ? target : null;
}

const MEDIA: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export function createApi({ vite, origin }: Deps) {
  const app = new Hono();

  // 사람이 스튜디오 화면에서 누른 요청인지 본다. 에이전트가 터미널에서 부르는 요청과 다른 사이트의 요청을 막는다.
  // 보안 경계라기보다 실수 방지다. 에이전트 지시문(task.md)도 이 요청을 부르지 말라고 적는다.
  const person = async (c: Context, next: Next) => {
    if (
      c.req.header("origin") !== origin() ||
      c.req.header("sec-fetch-site") !== "same-origin"
    ) {
      return c.json(
        { error: "스튜디오 화면에서 사람이 누른 요청만 받습니다." },
        403
      );
    }
    await next();
  };

  // 다른 이름으로 들어온 요청(DNS 리바인딩)은 받지 않는다
  app.use("/api/*", async (c, next) => {
    const host = c.req.header("host") ?? "";
    const port = new URL(origin()).port;
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`)
      return c.json({ error: "허용하지 않는 주소입니다." }, 403);
    await next();
  });

  // 에이전트의 cli.ts가 보내는 요청. 브라우저가 다른 사이트에서 보낸 요청은 막는다.
  // JSON만 받으므로 다른 사이트의 페이지는 사전 요청(preflight)에서 걸린다
  const agentOnly = async (c: Context, next: Next) => {
    const site = c.req.header("sec-fetch-site");
    if (site && site !== "same-origin")
      return c.json({ error: "다른 사이트의 요청은 받지 않습니다." }, 403);
    if (
      c.req.method === "POST" &&
      !(c.req.header("content-type") ?? "").includes("application/json")
    )
      return c.json({ error: "JSON 요청만 받습니다." }, 415);
    await next();
  };
  app.use("/api/agent/*", agentOnly);

  function record(c: Context): PostRecord {
    const found = getRecord(c.req.param("id") ?? "");
    if (!found) throw new HttpError(404, "글을 찾지 못했습니다.");
    return found;
  }

  app.onError((error, c) => {
    if (error instanceof HttpError)
      return c.json({ error: error.message }, error.status as 404);
    if (error instanceof StaleProposalError)
      return c.json({ error: error.message }, 409);
    console.error(error);
    return c.json({ error: message(error) }, 500);
  });

  // ── 설정 ──────────────────────────────────────────────

  app.get("/api/meta", async c => {
    const { settings, lockedByEnv } = loadSettings();
    let workspaces: { id: string; label: string; number: number }[] = [];
    let herdrError: string | null = null;
    if (herdr.available()) {
      try {
        workspaces = await herdr.listWorkspaces(settings);
      } catch (error) {
        herdrError = message(error);
      }
    } else herdrError = "herdr가 PATH에 없습니다.";
    return c.json({
      repoRoot: REPO_ROOT,
      stateDir: STATE_DIR,
      siteUrl: siteUrl(),
      settings,
      lockedByEnv,
      herdr: { available: herdr.available(), error: herdrError, workspaces },
      agents: {
        claude: which("claude") !== null,
        codex: which("codex") !== null,
      },
      gh: which("gh") !== null,
      stages: STAGES,
    });
  });

  app.put("/api/settings", person, async c => {
    const body = (await c.req.json()) as Record<string, string>;
    return c.json({ settings: saveSettings(body) });
  });

  // ── 글 목록 ────────────────────────────────────────────

  async function summarize(r: PostRecord) {
    const facts = gatherFacts(r);
    let proposals = 0;
    let staged = 0;
    let gitError: string | null = null;
    if (existsSync(r.worktree)) {
      try {
        proposals = (await listProposals(r.worktree)).length;
        staged = (await stagedFiles(r.worktree)).length;
      } catch (error) {
        gitError = message(error);
      }
    } else gitError = "worktree 폴더가 없습니다.";
    let pr = null;
    try {
      pr = await prInfo(r);
    } catch {
      pr = null;
    }
    const title = facts.draft.front.title ?? r.title;
    const live =
      pr?.state === "MERGED"
        ? await liveInfo(`${siteUrl()}/posts/${r.slug}/`, title).then(
            info => info.status === 200 && info.hasTitle
          )
        : null;
    return {
      id: r.id,
      slug: r.slug,
      title,
      mode: r.mode,
      createdAt: r.createdAt,
      branch: r.branch,
      agent: r.agent,
      hidden: Boolean(r.hidden),
      progress: judge(r, facts, { proposals, staged, pr, live }),
      counts: {
        proposals,
        staged,
        openComments: facts.openComments,
        agentQuestions: facts.agentQuestions,
      },
      lastActivity: facts.lastActivity,
      pr,
      live,
      gitError,
    };
  }

  app.get("/api/posts", async c => {
    const records = listRecords();
    return c.json({ posts: await Promise.all(records.map(summarize)) });
  });

  app.post("/api/posts", person, async c => {
    const body = (await c.req.json()) as {
      input: NewPostInput;
      agent: { kind: AgentKind; workspaceId: string } | null;
    };
    const { settings } = loadSettings();
    const created = await createPost(settings, body.input);
    if (body.agent)
      launchAgent(settings, created, { ...body.agent, studioUrl: origin() });
    return c.json({ id: created.id });
  });

  app.get("/api/published", async c => {
    return c.json({ posts: await listPublished() });
  });

  app.post("/api/fixes", person, async c => {
    const body = (await c.req.json()) as {
      slug: string;
      notes: string;
      agent: { kind: AgentKind; workspaceId: string } | null;
    };
    const { settings } = loadSettings();
    const created = await createFix(settings, body);
    if (body.agent)
      launchAgent(settings, created, { ...body.agent, studioUrl: origin() });
    return c.json({ id: created.id });
  });

  // ── 글 하나 ────────────────────────────────────────────

  app.get("/api/posts/:id", async c => {
    const r = record(c);
    const facts = gatherFacts(r);
    const exists = existsSync(r.worktree);
    const proposals = exists ? await listProposals(r.worktree) : [];
    const staged = exists ? await stagedFiles(r.worktree) : [];
    let pr = null;
    try {
      pr = await prInfo(r);
    } catch {
      pr = null;
    }
    const checks = readChecks(r);
    const site = siteUrl();
    return c.json({
      record: r,
      summary: await summarize(r),
      facts,
      proposals,
      staged,
      comments: readComments(r.workDir),
      preview: previewInfo(r.id, r.slug),
      checks,
      build: buildStatus(r.id),
      buildItems: checks?.build
        ? checks.build.ok
          ? metaItems(checks.build.meta, site, r.slug)
          : [
              {
                id: "build",
                level: "fail",
                title: "빌드가 실패했습니다",
                detail: checks.build.log.slice(-12).join("\n"),
              },
            ]
        : [],
      claims: existsSync(path.join(r.workDir, "claims.md"))
        ? readFileSync(path.join(r.workDir, "claims.md"), "utf8")
        : null,
      aiReview: existsSync(path.join(r.workDir, "ai-review.md"))
        ? readFileSync(path.join(r.workDir, "ai-review.md"), "utf8")
        : null,
      share: existsSync(path.join(r.workDir, "share.md"))
        ? readFileSync(path.join(r.workDir, "share.md"), "utf8")
        : null,
      siteUrl: site,
      pr,
    });
  });

  app.post("/api/posts/:id/hide", person, async c => {
    const r = record(c);
    stopPreview(r.id);
    updateRecord(r.id, x => {
      x.hidden = true;
    });
    return c.json({ ok: true });
  });

  app.post("/api/posts/:id/unhide", person, async c => {
    const r = record(c);
    updateRecord(r.id, x => {
      x.hidden = false;
    });
    return c.json({ ok: true });
  });

  /** 발행이 끝난 글의 worktree를 지운다. 커밋하지 않은 변경이 있으면 git이 거절한다 */
  app.post("/api/posts/:id/cleanup", person, async c => {
    const r = record(c);
    stopPreview(r.id);
    if (existsSync(r.worktree))
      await git(REPO_ROOT, ["worktree", "remove", r.worktree]);
    updateRecord(r.id, x => {
      x.hidden = true;
    });
    return c.json({ ok: true });
  });

  // ── 에이전트 ───────────────────────────────────────────

  app.post("/api/posts/:id/agent", person, async c => {
    const r = record(c);
    const body = (await c.req.json()) as {
      kind: AgentKind;
      workspaceId: string;
    };
    const { settings } = loadSettings();
    if (r.agent && (await agentAlive(settings, r)))
      throw new HttpError(409, "이미 에이전트가 떠 있습니다.");
    launchAgent(settings, r, { ...body, studioUrl: origin() });
    return c.json({ ok: true });
  });

  app.get("/api/posts/:id/agent", async c => {
    const r = record(c);
    const { settings } = loadSettings();
    return c.json({
      agent: r.agent,
      alive: await agentAlive(settings, r),
      cwd: await agentCwd(settings, r),
    });
  });

  app.post("/api/posts/:id/agent/focus", person, async c => {
    const r = record(c);
    if (!r.agent?.tabId) throw new HttpError(404, "에이전트 탭이 없습니다.");
    await herdr.focusTab(loadSettings().settings, r.agent.tabId);
    return c.json({ ok: true });
  });

  const MESSAGES: Record<string, (r: PostRecord) => string> = {
    "ai-review": r =>
      `[스튜디오] AI 점검을 요청합니다. ${path.join(r.workDir, "task.md")}의 5번대로 humanize-korean과 patina(반드시 --backend claude-cli)를 돌리고 결과를 ${path.join(r.workDir, "ai-review.md")}에 쓰세요. 원고를 고친 곳은 커밋하지 않고 둡니다.`,
    share: r =>
      `[스튜디오] 공유 글을 요청합니다. nomadamas-blog 스킬의 공유 절차대로 Threads, X, YouTube 커뮤니티 문안을 ${path.join(r.workDir, "share.md")}에 쓰세요. 게시는 하지 않습니다.`,
    nudge: () =>
      `[스튜디오] 진행 상황을 확인합니다. 지금 하는 일과 막힌 곳을 node ${path.join(STUDIO_DIR, "cli.ts")} ask "..."로 알려 주세요. 막힌 곳이 없으면 이어서 진행하세요.`,
    "read-task": r =>
      `블로그 스튜디오 작업입니다. ${path.join(r.workDir, "task.md")} 파일을 읽고 그대로 진행하세요.`,
  };

  app.post("/api/posts/:id/agent/message", person, async c => {
    const r = record(c);
    const { kind } = (await c.req.json()) as { kind: string };
    const build = MESSAGES[kind];
    if (!build) throw new HttpError(400, "모르는 메시지입니다.");
    const settings = loadSettings().settings;
    const result = await sendToAgent(settings, r.id, build(r));
    if (!result.ok) throw new HttpError(409, result.reason);
    if (kind === "read-task" && r.agent && r.agent.status !== "ready") {
      updateRecord(r.id, x => {
        if (x.agent) {
          x.agent.status = "ready";
          x.agent.error = undefined;
        }
      });
      void deliverPending(settings, r.id);
    }
    return c.json({ ok: true });
  });

  // ── 브리프 승인 ────────────────────────────────────────

  app.post("/api/posts/:id/brief/approve", person, async c => {
    const r = record(c);
    const { sha256: seen } = (await c.req.json()) as { sha256: string };
    const file = path.join(r.workDir, "brief.md");
    if (!existsSync(file)) throw new HttpError(404, "브리프가 없습니다.");
    const current = sha256(readFileSync(file, "utf8"));
    if (current !== seen)
      throw new HttpError(
        409,
        "화면에서 본 뒤 브리프가 바뀌었습니다. 새 브리프를 읽고 다시 승인하세요."
      );
    updateRecord(r.id, x => {
      x.briefApproval = {
        sha256: current,
        approvedAt: new Date().toISOString(),
      };
    });
    const sent = await sendToAgent(
      loadSettings().settings,
      r.id,
      `[스튜디오] 브리프 승인(brief.md ${current.slice(0, 8)}). 직접 써 보기 단계로 넘어가세요. 브리프를 고쳐야 하면 고친 뒤 다시 승인을 기다립니다.`
    );
    return c.json({
      ok: true,
      delivered: sent.ok,
      reason: sent.ok ? null : sent.reason,
    });
  });

  // ── 코멘트 ─────────────────────────────────────────────

  app.post("/api/posts/:id/comments", person, async c => {
    const r = record(c);
    const body = (await c.req.json()) as { anchor: Anchor; body: string };
    if (!body.body?.trim()) throw new HttpError(400, "코멘트가 비었습니다.");
    const comment = changeComments(r.workDir, comments => {
      const created = {
        id: nextCommentId(comments),
        createdAt: new Date().toISOString(),
        author: "person" as const,
        anchor: body.anchor,
        body: body.body.trim(),
        status: "open" as const,
        replies: [],
        delivery: r.agent ? ("pending" as const) : ("none" as const),
      };
      comments.push(created);
      return created;
    });
    void deliverPending(loadSettings().settings, r.id);
    return c.json({ comment });
  });

  app.post("/api/posts/:id/comments/:cid/reply", person, async c => {
    const r = record(c);
    const cid = c.req.param("cid");
    const { body } = (await c.req.json()) as { body: string };
    if (!body?.trim()) throw new HttpError(400, "답이 비었습니다.");
    changeComments(r.workDir, comments => {
      const target = comments.find(x => x.id === cid);
      if (!target) throw new HttpError(404, "코멘트를 찾지 못했습니다.");
      target.replies.push({
        at: new Date().toISOString(),
        author: "person",
        body: body.trim(),
      });
      target.status = "open";
      target.delivery = r.agent ? "pending" : "none";
    });
    void deliverPending(loadSettings().settings, r.id);
    return c.json({ ok: true });
  });

  app.post("/api/posts/:id/comments/:cid/resolve", person, async c => {
    const r = record(c);
    const cid = c.req.param("cid");
    const { resolved } = (await c.req.json()) as { resolved: boolean };
    changeComments(r.workDir, comments => {
      const target = comments.find(x => x.id === cid);
      if (!target) throw new HttpError(404, "코멘트를 찾지 못했습니다.");
      target.status = resolved ? "resolved" : "open";
    });
    return c.json({ ok: true });
  });

  app.post("/api/posts/:id/comments/:cid/resend", person, async c => {
    const r = record(c);
    const cid = c.req.param("cid");
    changeComments(r.workDir, comments => {
      const target = comments.find(x => x.id === cid);
      if (target) target.delivery = "pending";
    });
    await deliverPending(loadSettings().settings, r.id);
    return c.json({ comments: readComments(r.workDir) });
  });

  // ── 제안과 커밋 ────────────────────────────────────────

  app.post("/api/posts/:id/proposals/decide", person, async c => {
    const r = record(c);
    const { ids, verdict } = (await c.req.json()) as {
      ids: string[];
      verdict: "accept" | "reject";
    };
    const done = await decide(
      r.worktree,
      ids,
      verdict,
      path.join(STATE_DIR, "rejected", r.id)
    );
    return c.json({ done });
  });

  app.post("/api/posts/:id/unstage", person, async c => {
    const r = record(c);
    const { path: filePath } = (await c.req.json()) as { path: string };
    await unstage(r.worktree, filePath);
    return c.json({ ok: true });
  });

  app.post("/api/posts/:id/commit", person, async c => {
    const r = record(c);
    const { message: text } = (await c.req.json()) as { message: string };
    if (!text?.trim()) throw new HttpError(400, "커밋 메시지가 비었습니다.");
    if ((await stagedFiles(r.worktree)).length === 0)
      throw new HttpError(400, "수락한 변경이 없습니다.");
    await git(r.worktree, ["commit", "-m", text.trim()]);
    return c.json({ ok: true });
  });

  app.get("/api/posts/:id/file", async c => {
    const r = record(c);
    const which = c.req.query("root") === "work" ? r.workDir : r.worktree;
    const target = inside(which, c.req.query("path") ?? "");
    const type = target ? MEDIA[path.extname(target).toLowerCase()] : undefined;
    if (!target || !type || !existsSync(target) || !statSync(target).isFile())
      throw new HttpError(404, "파일을 찾지 못했습니다.");
    return c.body(readFileSync(target), 200, {
      "content-type": type,
      "cache-control": "no-store",
    });
  });

  // ── 미리보기 ───────────────────────────────────────────

  app.post("/api/posts/:id/preview/start", person, async c => {
    const r = record(c);
    startPreview(r, origin());
    return c.json({ preview: previewInfo(r.id, r.slug) });
  });

  app.post("/api/posts/:id/preview/stop", person, async c => {
    const r = record(c);
    stopPreview(r.id);
    return c.json({ ok: true });
  });

  // ── 점검 ───────────────────────────────────────────────

  app.post("/api/posts/:id/checks/quick", person, async c => {
    const r = record(c);
    const root = await toplevel(r.workDir);
    return c.json({ checks: await quickChecks(vite, r, root) });
  });

  app.post("/api/posts/:id/checks/build", person, async c => {
    const r = record(c);
    startBuild(r, siteUrl());
    return c.json({ ok: true });
  });

  app.get("/api/posts/:id/og.png", async c => {
    const r = record(c);
    const file = readChecks(r)?.build?.meta?.ogImageFile;
    if (!file || !existsSync(file))
      throw new HttpError(404, "빌드한 공유 이미지가 없습니다.");
    const type = MEDIA[path.extname(file).toLowerCase()] ?? "image/png";
    return c.body(readFileSync(file), 200, {
      "content-type": type,
      "cache-control": "no-store",
    });
  });

  // ── 발행 ───────────────────────────────────────────────

  app.get("/api/posts/:id/publish", async c => {
    const r = record(c);
    const facts = gatherFacts(r);
    const pr = await prInfo(r, 5_000);
    const site = siteUrl();
    const title = facts.draft.front.title ?? r.title;
    const description = facts.draft.front.description ?? "";
    return c.json({
      pr,
      checks: pr && pr.state === "OPEN" ? await prChecks(r, pr) : [],
      deploy:
        pr?.state === "MERGED" && pr.mergeCommit
          ? await deployRun(r, pr.mergeCommit)
          : null,
      live:
        pr?.state === "MERGED"
          ? await liveInfo(`${site}/posts/${r.slug}/`, title)
          : null,
      branch: existsSync(r.worktree) ? await branchState(r) : null,
      front: facts.draft.front,
      defaultTitle:
        r.mode === "fix" ? `fix(blog): ${title} 수정` : `post: ${title}`,
      defaultBody: prBodyTemplate(r, title, description),
    });
  });

  app.post("/api/posts/:id/publish/pubdate", person, async c => {
    const r = record(c);
    const at = await setPubDatetimeNow(r);
    return c.json({ pubDatetime: at });
  });

  app.post("/api/posts/:id/publish/push", person, async c => {
    await push(record(c));
    return c.json({ ok: true });
  });

  app.post("/api/posts/:id/publish/pr", person, async c => {
    const r = record(c);
    const body = (await c.req.json()) as { title: string; body: string };
    return c.json({ pr: await openPr(r, body) });
  });

  app.post("/api/posts/:id/publish/merge", person, async c => {
    const r = record(c);
    const { headSha } = (await c.req.json()) as { headSha: string };
    return c.json({ pr: await merge(r, headSha) });
  });

  // ── 에이전트가 부르는 요청(cli.ts) ─────────────────────
  // 승인, 수락, 커밋, 발행은 여기 없다. 코멘트를 읽고 답하고, 사람에게 묻는 것만 된다.

  app.get("/api/agent/:id/status", async c => {
    const r = record(c);
    const s = await summarize(r);
    const facts = gatherFacts(r);
    return c.json({
      id: r.id,
      slug: r.slug,
      stage: s.progress.stage,
      note: s.progress.note,
      briefApproved: facts.brief.approved,
      proposals: s.counts.proposals,
      openComments: s.counts.openComments,
      worktree: r.worktree,
      workDir: r.workDir,
    });
  });

  app.get("/api/agent/:id/comments", async c => {
    const r = record(c);
    const all = c.req.query("all") === "1";
    return c.json({
      comments: readComments(r.workDir).filter(x => all || x.status === "open"),
    });
  });

  app.post("/api/agent/:id/comments/:cid/reply", async c => {
    const r = record(c);
    const cid = c.req.param("cid");
    const { body } = (await c.req.json()) as { body: string };
    if (!body?.trim()) throw new HttpError(400, "답이 비었습니다.");
    changeComments(r.workDir, comments => {
      const target = comments.find(x => x.id === cid);
      if (!target) throw new HttpError(404, "코멘트를 찾지 못했습니다.");
      target.replies.push({
        at: new Date().toISOString(),
        author: "agent",
        body: body.trim(),
      });
    });
    return c.json({ ok: true });
  });

  app.post("/api/agent/:id/ask", async c => {
    const r = record(c);
    const { body } = (await c.req.json()) as { body: string };
    if (!body?.trim()) throw new HttpError(400, "질문이 비었습니다.");
    const comment = changeComments(r.workDir, comments => {
      const created = {
        id: nextCommentId(comments),
        createdAt: new Date().toISOString(),
        author: "agent" as const,
        anchor: { kind: "post" as const },
        body: body.trim(),
        status: "open" as const,
        replies: [],
        delivery: "none" as const,
      };
      comments.push(created);
      return created;
    });
    return c.json({ id: comment.id });
  });

  return app;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, text: string) {
    super(text);
    this.status = status;
  }
}
