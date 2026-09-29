import { execFileSync } from "node:child_process";

// 글 제목 아래 "작성"과 "최근 수정" 줄, 그리고 글쓴이 표기(메타 태그, 구조화 데이터, OG 이미지)의 값.
// GitHub에 올라간 그 글 파일의 커밋 기록에서 파일을 처음 추가한 커밋과 가장 최근 커밋의 GitHub 계정을 쓴다.
// 이름표를 저장소에 따로 두지 않는다. 표시 이름은 GitHub 프로필 이름이고, 비어 있으면 아이디다.
//
// 작성자는 파일을 처음 추가한 커밋으로 정해진다. git 기록은 바뀌지 않으므로 이후 누가 고쳐도,
// 파일 이름을 바꿔도 그대로다. 커밋 이메일이 GitHub 계정에 등록돼 있지 않으면 GitHub이 author를
// 비워 보내므로 그 커밋이 들어온 PR을 연 계정으로 대신한다. 둘 다 없으면 커밋에 적힌 이름만 쓴다.

export type PostAuthor = {
  /** GitHub 프로필 이름. 비어 있으면 아이디, 계정을 못 찾으면 커밋에 적힌 이름 */
  name: string;
  /** GitHub 프로필 주소. 계정을 못 찾으면 없다 */
  url?: string;
  /** Pages CMS, Actions 같은 봇 계정 */
  bot?: boolean;
};

export type PostAuthors = {
  createdBy: PostAuthor;
  /** 처음 추가한 커밋 뒤로 고친 적이 없으면 null이다 */
  lastEditedBy: PostAuthor | null;
};

type Account = { login: string; html_url: string; type: string };
type Commit = {
  sha: string;
  author: Account | null;
  commit: { author: { name: string } };
};
type ChangedFile = {
  filename: string;
  status: string;
  previous_filename?: string;
};
type PullRequest = { user: Account | null; merged_at: string | null };

const API = process.env.GITHUB_API_URL ?? "https://api.github.com";

// CI에서는 Actions가 넣어 주는 저장소 이름을, 로컬에서는 origin 주소를 쓴다
function repository(): string | null {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const origin = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return (
      origin.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\s*$/)?.[1] ?? null
    );
  } catch {
    return null;
  }
}

async function get<T>(url: string): Promise<{ data: T; last?: string }> {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "astro-post-authors",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const limited = res.status === 403 || res.status === 429;
    throw new Error(
      `GitHub API 요청이 실패했습니다 (${res.status}): ${url}` +
        (limited ? ". 토큰 없이 요청하면 시간당 60회로 제한됩니다" : "")
    );
  }
  const last = res.headers.get("link")?.match(/<([^>]+)>;\s*rel="last"/)?.[1];
  return { data: (await res.json()) as T, last };
}

// 경로 하나의 커밋 기록에서 가장 최근 커밋과 가장 오래된 커밋. 최신 커밋이 먼저 오고,
// 가장 오래된 커밋은 마지막 쪽의 끝에 있다. CI에서는 지금 빌드하는 커밋 기준, 로컬에서는 기본 브랜치 기준이다
async function history(repo: string, path: string) {
  const params = new URLSearchParams({ path, per_page: "100" });
  if (process.env.GITHUB_SHA) params.set("sha", process.env.GITHUB_SHA);

  const first = await get<Commit[]>(`${API}/repos/${repo}/commits?${params}`);
  const last = first.last ? await get<Commit[]>(first.last) : first;
  const newest = first.data[0];
  const oldest = last.data.at(-1);
  return newest && oldest ? { newest, oldest } : null;
}

// GitHub API의 경로 필터는 파일 이름 변경을 따라가지 않는다. 가장 오래된 커밋이 이름을 바꾼 커밋이면
// 이전 이름의 기록으로 넘어가서, 이름을 바꾼 사람이 작성자로 잡히지 않게 한다.
// git이 이름 변경으로 알아본 경우만 따라간다. 같은 커밋에서 내용까지 크게 고치면 새 파일로 잡힌다
async function addedIn(
  repo: string,
  path: string,
  oldest: Commit
): Promise<Commit> {
  let commit = oldest;
  let current = path;
  for (let hop = 0; hop < 10; hop++) {
    const { data } = await get<{ files?: ChangedFile[] }>(
      `${API}/repos/${repo}/commits/${commit.sha}`
    );
    const file = data.files?.find(f => f.filename === current);
    if (file?.status !== "renamed" || !file.previous_filename) return commit;

    current = file.previous_filename;
    const earlier = await history(repo, current);
    if (!earlier) return commit;
    commit = earlier.oldest;
  }
  return commit;
}

const profileNames = new Map<string, Promise<string>>();

async function user(account: Account): Promise<PostAuthor> {
  let name = profileNames.get(account.login);
  if (!name) {
    name = get<{ name: string | null }>(`${API}/users/${account.login}`).then(
      ({ data }) => data.name?.trim() || account.login
    );
    profileNames.set(account.login, name);
  }
  return { name: await name, url: account.html_url };
}

async function resolve(repo: string, commit: Commit): Promise<PostAuthor> {
  if (commit.author?.type === "User") return user(commit.author);

  // 계정을 못 찾았거나 봇이 올린 커밋이면 그 커밋이 들어온 PR을 연 사람을 본다
  const { data: pulls } = await get<PullRequest[]>(
    `${API}/repos/${repo}/commits/${commit.sha}/pulls`
  );
  const opener = (pulls.find(pr => pr.merged_at) ?? pulls[0])?.user;
  if (opener?.type === "User") return user(opener);

  const bot = commit.author ?? opener;
  return bot
    ? { name: bot.login, url: bot.html_url, bot: true }
    : { name: commit.commit.author.name };
}

async function load(filePath: string): Promise<PostAuthors | null> {
  const repo = repository();
  if (!repo) return null;

  const current = await history(repo, filePath);
  // 아직 GitHub에 올리지 않은 글
  if (!current) return null;

  const added = await addedIn(repo, filePath, current.oldest);
  return {
    createdBy: await resolve(repo, added),
    lastEditedBy:
      current.newest.sha === added.sha
        ? null
        : await resolve(repo, current.newest),
  };
}

const cache = new Map<string, Promise<PostAuthors | null>>();

/**
 * 배포 빌드(CI)에서는 GitHub 요청이 실패하면 빌드를 멈춘다. 줄을 조용히 빼고 배포하면
 * 모든 글에서 작성자가 사라진 걸 한참 뒤에 알게 된다. 로컬에서는 토큰 없이 돌려
 * 요청 한도에 걸리기 쉬우므로 줄만 빼고 넘어간다.
 */
export function getPostAuthors(
  filePath: string | undefined
): Promise<PostAuthors | null> {
  if (!filePath) return Promise.resolve(null);

  let result = cache.get(filePath);
  if (!result) {
    result = load(filePath).catch(error => {
      if (process.env.CI) throw error;
      return null;
    });
    cache.set(filePath, result);
  }
  return result;
}

/**
 * 글쓴이 표기(메타 태그, 구조화 데이터, OG 이미지)에 쓸 작성자. 화면의 "작성"과 같은 사람이다.
 * 봇이 처음 올린 글과 GitHub 기록을 못 받은 글은 null이라 프런트매터 author로 돌아간다.
 */
export function byline(authors: PostAuthors | null): PostAuthor | null {
  return authors && !authors.createdBy.bot ? authors.createdBy : null;
}
