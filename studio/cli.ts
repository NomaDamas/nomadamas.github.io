// 에이전트가 터미널에서 부르는 스튜디오 명령. 코멘트를 읽고 답하고, 사람에게 묻는 것만 한다.
// 승인, 수락, 커밋, 발행은 사람이 스튜디오 화면에서 한다.
//
//   node studio/cli.ts status
//   node studio/cli.ts comments [--all]
//   node studio/cli.ts reply c3 "제목을 줄였습니다"
//   node studio/cli.ts ask "비교 대상을 셋으로 줄일까요?"
//
// 어느 글인지는 스튜디오가 에이전트 탭에 넣어 둔 STUDIO_POST, 주소는 STUDIO_URL에서 읽는다.
// 다른 터미널에서 부르면 --post <id>와 --url <주소>를 준다.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STUDIO_DIR = path.dirname(fileURLToPath(import.meta.url));

type Comment = {
  id: string;
  author: "person" | "agent";
  anchor: { kind: string; quote?: string; alt?: string; src?: string };
  body: string;
  status: string;
  replies: { author: string; body: string; at: string }[];
};

function option(args: string[], name: string) {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  const value = args[at + 1];
  args.splice(at, 2);
  return value;
}

function studioUrl(explicit: string | undefined) {
  if (explicit) return explicit;
  if (process.env.STUDIO_URL) return process.env.STUDIO_URL;
  // 스튜디오가 켜지면 저장소 루트의 .studio/runtime.json에 주소를 적는다
  let dir = STUDIO_DIR;
  for (let i = 0; i < 3; i++) {
    const file = path.join(dir, ".studio", "runtime.json");
    if (existsSync(file))
      return (JSON.parse(readFileSync(file, "utf8")) as { url: string }).url;
    dir = path.dirname(dir);
  }
  return null;
}

async function call(
  url: string,
  method: string,
  route: string,
  body?: unknown
) {
  let response: Response;
  try {
    response = await fetch(`${url}${route}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      `스튜디오(${url})에 닿지 못했습니다. 스튜디오가 켜져 있는지 확인하세요.`
    );
  }
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(data.error ?? response.status));
  return data;
}

function where(comment: Comment) {
  const a = comment.anchor;
  if (a.kind === "text" || a.kind === "brief")
    return `${a.kind === "brief" ? "브리프" : "원고"} "${a.quote}"`;
  if (a.kind === "image") return `이미지 ${a.alt || a.src}`;
  return "글 전체";
}

async function main() {
  const args = process.argv.slice(2);
  const post = option(args, "--post") ?? process.env.STUDIO_POST;
  const url = studioUrl(option(args, "--url"));
  const [command, ...rest] = args;
  if (!command || command === "help" || command === "--help") {
    console.log(
      readFileSync(fileURLToPath(import.meta.url), "utf8")
        .split("\n")
        .filter(line => line.startsWith("//"))
        .map(line => line.slice(3))
        .join("\n")
    );
    return;
  }
  if (!url) throw new Error("스튜디오 주소를 찾지 못했습니다. --url을 주세요.");
  if (!post) throw new Error("어느 글인지 모릅니다. --post <id>를 주세요.");
  const base = `/api/agent/${encodeURIComponent(post)}`;

  if (command === "status") {
    const status = await call(url, "GET", `${base}/status`);
    for (const [key, value] of Object.entries(status))
      console.log(`${key}: ${value}`);
    return;
  }
  if (command === "comments") {
    const all = rest.includes("--all");
    const { comments } = (await call(
      url,
      "GET",
      `${base}/comments${all ? "?all=1" : ""}`
    )) as {
      comments: Comment[];
    };
    if (comments.length === 0) console.log("남은 코멘트가 없습니다.");
    for (const comment of comments) {
      const who = comment.author === "agent" ? "에이전트 질문" : "사람 코멘트";
      console.log(
        `${comment.id} [${who}, ${comment.status}] ${where(comment)}`
      );
      console.log(`  ${comment.body}`);
      for (const reply of comment.replies)
        console.log(
          `  - ${reply.author === "agent" ? "에이전트" : "사람"}: ${reply.body}`
        );
    }
    return;
  }
  if (command === "reply") {
    const [id, ...words] = rest;
    if (!id || words.length === 0)
      throw new Error('사용법: reply c3 "무엇을 고쳤는지"');
    await call(url, "POST", `${base}/comments/${id}/reply`, {
      body: words.join(" "),
    });
    console.log(`${id}에 답을 달았습니다.`);
    return;
  }
  if (command === "ask") {
    if (rest.length === 0) throw new Error('사용법: ask "질문"');
    const { id } = (await call(url, "POST", `${base}/ask`, {
      body: rest.join(" "),
    })) as { id: string };
    console.log(
      `스튜디오에 질문을 올렸습니다(${id}). 사람의 답은 [스튜디오 답변 ${id}] 메시지로 옵니다.`
    );
    return;
  }
  throw new Error(`모르는 명령입니다: ${command}. help를 보세요.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
