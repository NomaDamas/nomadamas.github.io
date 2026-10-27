import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { navigate, usePath, usePoll, type Meta } from "./lib.ts";
import { Home } from "./pages/Home.tsx";
import { NewPost } from "./pages/NewPost.tsx";
import { FixPost } from "./pages/FixPost.tsx";
import { SettingsPage } from "./pages/Settings.tsx";
import { PostPage } from "./pages/Post.tsx";
import "./styles.css";

function App() {
  const path = usePath();
  const { data: meta, refresh } = usePoll<Meta>("/api/meta", 30_000);
  const [crumb, setCrumb] = useState("");
  const pathname = path.split("?")[0] ?? "/";
  const postId = /^\/post\/([^/]+)/.exec(pathname)?.[1];

  useEffect(() => {
    document.title = crumb ? `${crumb} · 블로그 스튜디오` : "블로그 스튜디오";
  }, [crumb]);

  let page;
  if (postId)
    page = (
      <PostPage
        id={decodeURIComponent(postId)}
        meta={meta}
        setCrumb={setCrumb}
      />
    );
  else if (pathname === "/new") page = <NewPost meta={meta} />;
  else if (pathname === "/fix") page = <FixPost meta={meta} />;
  else if (pathname === "/settings")
    page = <SettingsPage meta={meta} onSaved={refresh} />;
  else page = <Home meta={meta} />;

  return (
    <div className="app">
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={event => {
            event.preventDefault();
            setCrumb("");
            navigate("/");
          }}
        >
          블로그 스튜디오
        </a>
        {postId && crumb && <span className="crumb">/ {crumb}</span>}
        <span className="spacer" />
        {meta && !meta.herdr.available && (
          <span className="badge red">herdr 없음</span>
        )}
        {meta?.herdr.error && meta.herdr.available && (
          <span className="badge yellow" title={meta.herdr.error}>
            herdr 연결 안 됨
          </span>
        )}
        <a
          className="btn ghost small"
          href="/settings"
          onClick={event => {
            event.preventDefault();
            navigate("/settings");
          }}
        >
          설정
        </a>
      </header>
      {page}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
