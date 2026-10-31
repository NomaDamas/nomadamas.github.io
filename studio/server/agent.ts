import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { STUDIO_DIR, type AgentKind, type Settings } from "./config.ts";
import * as herdr from "./herdr.ts";
import { toplevel } from "./git.ts";
import { draftPath, IMAGES_DIR } from "./posts.ts";
import {
  changeComments,
  getRecord,
  updateRecord,
  type Comment,
  type PostRecord,
} from "./store.ts";

// 글마다 herdr 탭 하나에 에이전트 하나를 띄운다. 긴 지시는 작업 폴더의 task.md에 쓰고
// 터미널에는 한 줄만 보낸다. 여러 줄을 터미널에 붙이면 중간 줄바꿈에서 제출될 수 있다.

const CLI = path.join(STUDIO_DIR, "cli.ts");

function cliCommand(args: string) {
  return `node ${CLI} ${args}`;
}

function oneLine(text: string, max = 600) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** 에이전트를 띄울 폴더. 작업 폴더가 든 저장소의 루트에서 띄워야 그 저장소의 스킬(nomadamas-blog)이 보인다 */
export async function agentCwd(settings: Settings, record: PostRecord) {
  if (settings.agentCwd) return settings.agentCwd;
  return (await toplevel(record.workDir)) ?? record.worktree;
}

export function taskMarkdown(record: PostRecord, studioUrl: string) {
  const draft = draftPath(record);
  const images = path.join(record.worktree, IMAGES_DIR, record.slug);
  const common = [
    "## 스튜디오 규칙",
    "",
    "- `git add`, `commit`, `push`, PR 생성, 머지를 하지 않는다. 고친 내용을 커밋하지 않은 채로 두면 스튜디오가 덩어리별 제안으로 보여 주고 사람이 수락해 커밋한다.",
    "- 스튜디오의 승인, 수락, 커밋, 머지 요청을 직접 보내지 않는다. 브라우저 자동화로 스튜디오 버튼을 누르지도 않는다.",
    `- 사람의 코멘트는 \`[스튜디오 코멘트 cN]\`으로 시작하는 메시지로 온다. 반영한 뒤 \`${cliCommand('reply cN "무엇을 고쳤는지"')}\`로 답한다. 반영하지 않기로 했으면 이유를 답한다.`,
    `- 사람에게 물어야 진행할 수 있으면 \`${cliCommand('ask "질문"')}\`으로 묻고 답을 기다린다. 답은 \`[스튜디오 답변 cN]\` 메시지로 온다.`,
    `- 남은 코멘트와 진행 상태는 \`${cliCommand("status")}\`, \`${cliCommand("comments")}\`로 본다.`,
    "- 원고의 수치와 단정은 근거 표에 남긴다. 사람이 미리보기에서 바로 읽으므로 원고는 늘 빌드되는 상태로 둔다.",
    "",
  ];
  if (record.mode === "fix") {
    return [
      `# 블로그 스튜디오 작업: 발행된 글 고치기 (${record.slug})`,
      "",
      `사람이 블로그 스튜디오(${studioUrl})에서 이 글을 고치고 있다. 미리보기에 남긴 코멘트가 메시지로 온다.`,
      "",
      "## 경로",
      "",
      `- 요청: \`${path.join(record.workDir, "request.md")}\``,
      `- 작업 폴더: \`${record.workDir}\``,
      `- 글 worktree: \`${record.worktree}\` (브랜치 \`${record.branch}\`)`,
      `- 원고: \`${draft}\``,
      `- 이미지: \`${images}/\``,
      "",
      "## 진행",
      "",
      "1. nomadamas-blog 스킬과 블로그 저장소 `AGENTS.md`를 읽는다. 아래 스튜디오 규칙이 우선한다.",
      "2. 요청 파일의 고칠 것을 반영한다. 비어 있으면 코멘트를 기다린다.",
      "3. 수정 범위 밖의 문장은 건드리지 않는다. 발행된 글이라 바뀐 곳마다 사람이 수락한다.",
      "",
      ...common,
    ].join("\n");
  }
  return [
    `# 블로그 스튜디오 작업: ${record.title} (${record.slug})`,
    "",
    `사람이 블로그 스튜디오(${studioUrl})에서 진행을 보고, 승인하고, 코멘트를 남긴다.`,
    "스튜디오는 아래 파일이 생기는 것으로 단계를 알아본다. 파일 이름을 바꾸지 않는다.",
    "",
    "## 경로",
    "",
    `- 요청(사람이 새 글 폼에 쓴 것): \`${path.join(record.workDir, "request.md")}\``,
    `- 작업 폴더(브리프, 근거 표, 캡처 원본, 로그): \`${record.workDir}\``,
    `- 글 worktree: \`${record.worktree}\` (브랜치 \`${record.branch}\`)`,
    `- 원고: \`${draft}\``,
    `- 이미지: \`${images}/\``,
    "",
    "## 진행",
    "",
    "1. nomadamas-blog 스킬을 읽고 그 흐름을 따른다. 주제는 요청으로 정해졌으니 주제 정하기는 건너뛴다.",
    `2. 브리프: \`${path.join(record.workDir, "brief.md")}\`에 독자, 글 유형, 검색 키워드, 이 글이 남길 한 문장, 절 목록, 절마다 넣을 화면을 쓴다. 다 쓰면 멈추고 기다린다. 사람이 스튜디오에서 승인하면 \`[스튜디오] 브리프 승인\` 메시지가 온다. 승인 전에는 원고를 쓰지 않는다.`,
    `3. 직접 써 보기: 근거 표는 \`${path.join(record.workDir, "claims.md")}\`, 캡처 원본은 \`${path.join(record.workDir, "captures")}/\`에 둔다.`,
    "4. 원고: 위 원고 경로에 쓴다. 이미지는 위 이미지 폴더에 둔다.",
    `5. 점검: 사람이 스튜디오 점검 탭에서 결정적 검사를 돌린다. \`[스튜디오] AI 점검\` 메시지가 오면 스킬의 검수 절차(humanize-korean, patina는 반드시 \`--backend claude-cli\`)를 돌리고 결과를 \`${path.join(record.workDir, "ai-review.md")}\`에 쓴다. 원고를 고친 곳은 커밋하지 않고 둔다.`,
    `6. 발행 뒤: \`[스튜디오] 공유 글\` 메시지가 오면 스킬의 공유 절차대로 \`${path.join(record.workDir, "share.md")}\`에 쓴다. 게시는 하지 않는다.`,
    "",
    ...common,
  ].join("\n");
}

function agentArgs(kind: AgentKind, cwd: string, record: PostRecord) {
  const dirs = [record.worktree, record.workDir].filter(
    dir => !dir.startsWith(cwd + path.sep) && dir !== cwd
  );
  const args = dirs.flatMap(dir => ["--add-dir", dir]);
  // 공유 데몬은 처음 띄운 터미널의 환경을 붙잡는다. 이 탭에 묶어 두려고 데몬 없이 띄운다
  if (kind === "codex") args.unshift("--no-daemon");
  return args;
}

/** 탭을 만들고 에이전트를 띄운 뒤 task.md를 읽으라는 한 줄을 보낸다. 오래 걸려서 기다리지 않고 돌린다 */
export function launchAgent(
  settings: Settings,
  record: PostRecord,
  options: { kind: AgentKind; workspaceId: string; studioUrl: string }
) {
  const name = `studio-${record.id}`.slice(0, 60);
  updateRecord(record.id, r => {
    r.agent = {
      kind: options.kind,
      name,
      workspaceId: options.workspaceId,
      tabId: "",
      paneId: "",
      startedAt: new Date().toISOString(),
      status: "starting",
    };
  });
  void (async () => {
    try {
      const taskFile = path.join(record.workDir, "task.md");
      writeFileSync(taskFile, taskMarkdown(record, options.studioUrl));
      const cwd = await agentCwd(settings, record);
      const { tabId, paneId } = await herdr.createTab(settings, {
        workspaceId: options.workspaceId,
        cwd,
        label: `글 ${record.slug}`.slice(0, 40),
        env: {
          STUDIO_URL: options.studioUrl,
          STUDIO_POST: record.id,
        },
      });
      updateRecord(record.id, r => {
        if (r.agent) Object.assign(r.agent, { tabId, paneId });
      });
      await herdr.startAgent(settings, {
        name,
        kind: options.kind,
        paneId,
        args: agentArgs(options.kind, cwd, record),
      });
      await herdr.prompt(
        settings,
        paneId,
        `블로그 스튜디오 작업입니다. ${taskFile} 파일을 읽고 그대로 진행하세요.`
      );
      updateRecord(record.id, r => {
        if (r.agent) r.agent.status = "ready";
      });
      // 에이전트가 없을 때 남긴 코멘트도 이제 보낸다
      changeComments(record.workDir, comments => {
        for (const c of comments) {
          if (
            c.author === "person" &&
            c.status === "open" &&
            c.delivery === "none"
          )
            c.delivery = "pending";
        }
      });
      await deliverPending(settings, record.id);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      // 폴더 신뢰 같은 확인 창은 스튜디오가 대신 답하지 않는다. 사람이 탭에서 답한 뒤 지시문을 다시 보낸다
      const blocked = /blocked|not ready/i.test(text);
      updateRecord(record.id, r => {
        if (r.agent) {
          r.agent.status = blocked && r.agent.paneId ? "blocked" : "error";
          r.agent.error = blocked
            ? "에이전트 창에 확인 창이 떠 있습니다(폴더 신뢰 등). herdr 탭에서 직접 답한 뒤 '지시문 보내기'를 누르세요."
            : text;
        }
      });
    }
  })();
}

/** 기록한 pane이 아직 같은 종류의 에이전트를 돌리는지 본다. 사용자가 탭을 닫았거나 다른 걸 띄웠으면 보내지 않는다 */
export async function agentAlive(settings: Settings, record: PostRecord) {
  const agent = record.agent;
  if (!agent || agent.status === "starting" || !agent.paneId) return false;
  try {
    const pane = await herdr.findPane(settings, agent.paneId);
    return Boolean(pane && pane.agent === agent.kind);
  } catch {
    return false;
  }
}

export async function sendToAgent(
  settings: Settings,
  id: string,
  text: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const record = getRecord(id);
  if (!record?.agent)
    return { ok: false, reason: "이 글에 띄운 에이전트가 없습니다." };
  if (!(await agentAlive(settings, record)))
    return {
      ok: false,
      reason:
        "에이전트 탭을 찾지 못했습니다. 탭을 닫았거나 에이전트가 끝났으면 다시 띄우세요.",
    };
  try {
    await herdr.prompt(settings, record.agent.paneId, oneLine(text, 1500));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function commentMessage(comment: Comment) {
  const anchor = comment.anchor;
  const where =
    anchor.kind === "text"
      ? `원고의 "${oneLine(anchor.quote, 120)}" 부분`
      : anchor.kind === "image"
        ? `이미지(${anchor.alt || anchor.src})`
        : anchor.kind === "brief"
          ? `브리프의 "${oneLine(anchor.quote, 120)}" 부분`
          : "글 전체";
  return `[스튜디오 코멘트 ${comment.id}] ${where}: ${oneLine(comment.body)} / 반영한 뒤 ${cliCommand(`reply ${comment.id} "무엇을 고쳤는지"`)}로 답하세요.`;
}

function messageFor(comment: Comment) {
  const lastPerson = comment.replies.filter(r => r.author === "person").at(-1);
  if (comment.author === "agent") {
    return `[스튜디오 답변 ${comment.id}] 질문 "${oneLine(comment.body, 120)}"에 대한 사람의 답: ${oneLine(lastPerson?.body ?? "")}`;
  }
  if (lastPerson) {
    return `[스튜디오 코멘트 ${comment.id} 이어서] ${oneLine(lastPerson.body)} (처음 코멘트: ${oneLine(comment.body, 200)}) / 반영한 뒤 ${cliCommand(`reply ${comment.id} "무엇을 고쳤는지"`)}로 답하세요.`;
  }
  return commentMessage(comment);
}

/** 아직 못 보낸 코멘트와 답변을 보낸다 */
export async function deliverPending(settings: Settings, id: string) {
  const record = getRecord(id);
  if (!record || !(await agentAlive(settings, record))) return;
  const pending = changeComments(record.workDir, comments =>
    comments.filter(c => c.delivery === "pending")
  );
  for (const comment of pending) {
    const result = await sendToAgent(settings, id, messageFor(comment));
    changeComments(record.workDir, comments => {
      const target = comments.find(c => c.id === comment.id);
      if (!target) return;
      target.delivery = result.ok ? "sent" : "failed";
      target.deliveryError = result.ok ? undefined : result.reason;
    });
    if (!result.ok) break;
  }
}

export function hasTask(record: PostRecord) {
  return existsSync(path.join(record.workDir, "task.md"));
}
