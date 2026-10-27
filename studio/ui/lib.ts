import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentKind, Settings } from "../server/config.ts";
import type { Proposal } from "../server/changes.ts";
import type { ChecksFile, CheckItem } from "../server/checks.ts";
import type { Facts, PrInfo, Progress, StageKey } from "../server/posts.ts";
import type { Comment, PostRecord } from "../server/store.ts";

export type {
  AgentKind,
  Comment,
  CheckItem,
  Facts,
  PostRecord,
  PrInfo,
  Proposal,
  StageKey,
};

export type Meta = {
  repoRoot: string;
  stateDir: string;
  siteUrl: string;
  settings: Settings;
  lockedByEnv: (keyof Settings)[];
  herdr: {
    available: boolean;
    error: string | null;
    workspaces: { id: string; label: string; number: number }[];
  };
  agents: { claude: boolean; codex: boolean };
  gh: boolean;
  stages: { key: StageKey; label: string }[];
};

export type Summary = {
  id: string;
  slug: string;
  title: string;
  mode: "new" | "fix";
  createdAt: string;
  branch: string;
  agent: PostRecord["agent"];
  hidden: boolean;
  progress: Progress;
  counts: {
    proposals: number;
    staged: number;
    openComments: number;
    agentQuestions: number;
  };
  lastActivity: number;
  pr: PrInfo | null;
  live: boolean | null;
  gitError: string | null;
};

export type Detail = {
  record: PostRecord;
  summary: Summary;
  facts: Facts;
  proposals: Proposal[];
  staged: { status: string; path: string }[];
  comments: Comment[];
  preview: {
    status: "installing" | "starting" | "running" | "error" | "stopped";
    url: string | null;
    log: string[];
    error?: string;
  };
  checks: ChecksFile | null;
  build: { running: boolean; log: string[] };
  buildItems: CheckItem[];
  claims: string | null;
  aiReview: string | null;
  share: string | null;
  siteUrl: string;
  pr: PrInfo | null;
};

export class ApiError extends Error {}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body
      ? { "content-type": "application/json", ...init.headers }
      : init?.headers,
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) throw new ApiError(data.error ?? `${response.status}`);
  return data as T;
}

export function send<T = { ok: boolean }>(
  url: string,
  body?: unknown,
  method = "POST"
) {
  return api<T>(url, { method, body: JSON.stringify(body ?? {}) });
}

/** 주기적으로 다시 불러온다. 탭이 안 보이면 쉰다 */
export function usePoll<T>(url: string | null, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;
  const load = useCallback(async () => {
    const target = urlRef.current;
    if (!target) return;
    try {
      const next = await api<T>(target);
      if (urlRef.current === target) {
        setData(next);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    setData(null);
    void load();
    if (!url) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [url, intervalMs, load]);
  return { data, error, refresh: load };
}

export function navigate(to: string) {
  history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePath() {
  const [path, setPath] = useState(location.pathname + location.search);
  useEffect(() => {
    const update = () => setPath(location.pathname + location.search);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return path;
}

export function timeAgo(time: number | string) {
  const ms = typeof time === "number" ? time : Date.parse(time);
  if (!ms) return "";
  const seconds = Math.round((Date.now() - ms) / 1000);
  if (seconds < 60) return "방금";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

/** 버튼을 누르는 동안 막고, 실패하면 메시지를 돌려준다 */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runAction = useCallback(
    async (name: string, action: () => Promise<unknown>) => {
      setBusy(name);
      setError(null);
      try {
        await action();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(null);
      }
    },
    []
  );
  return { busy, error, setError, run: runAction };
}
