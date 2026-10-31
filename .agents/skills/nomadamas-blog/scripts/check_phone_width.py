#!/usr/bin/env python3
"""빌드한 블로그 글을 폰 폭으로 띄워 가로로 넘치는 요소를 잰다.

사용:
  check_phone_width.py <dist 폴더> <slug> [--width 390] [--chrome <Chrome 실행 파일>]

dist를 임시 로컬 서버(127.0.0.1, 빈 포트)로 띄우고, 같은 출처의 측정 페이지에서 글을
그 폭의 iframe으로 연다. headless Chrome은 창 폭을 약 500px 아래로 줄이지 못해서 iframe으로
폭을 맞춘다. 측정 페이지는 메모리에서 내보내므로 dist에 파일을 쓰지 않는다.

가로 스크롤 상자(코드 블록, 넓은 표를 감싼 상자) 안의 요소는 넘쳐도 된다.

종료 코드: 0 넘침 없음, 1 넘침 있음, 2 측정하지 못함
"""

import argparse
import functools
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PAGE = "/__phone_check.html"
# 글이 이미지와 글꼴을 받고 측정 스크립트의 대기(1.5초)가 끝날 때까지의 가상 시간
VIRTUAL_TIME_MS = 8000
# Chrome이 끝나지 않아도 세션을 묶지 않도록 끊는 실제 시간
TIMEOUT_S = 60
# 소수점 반올림으로 생기는 1px은 넘침으로 보지 않는다
TOLERANCE_PX = 1

WRAPPER = """<!doctype html><html><body style="margin:0">
<iframe id="f" src="/posts/SLUG/" style="width:WIDTHpx;height:900px;border:0"></iframe>
<pre id="out">pending</pre>
<script>
document.getElementById('f').addEventListener('load', () => setTimeout(() => {
  const d = document.getElementById('f').contentDocument;
  const limit = WIDTH + TOLERANCE;
  const inScroller = e => {
    for (let p = e.parentElement; p && p !== d.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };
  const wide = [...d.querySelectorAll('body *')].filter(e =>
    getComputedStyle(e).position !== 'fixed' && !inScroller(e) &&
    e.getBoundingClientRect().right > limit);
  document.getElementById('out').textContent = JSON.stringify({
    scrollWidth: d.documentElement.scrollWidth,
    count: wide.length,
    wide: wide.slice(0, 10).map(e => ({
      tag: e.tagName.toLowerCase(),
      cls: String(e.className).slice(0, 60),
      text: (e.textContent || '').trim().slice(0, 30),
      right: Math.round(e.getBoundingClientRect().right),
    })),
  });
}, 1500));
</script></body></html>"""


class Handler(SimpleHTTPRequestHandler):
    wrapper = b""

    def do_GET(self):
        if self.path.split("?")[0] == PAGE:
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(self.wrapper)))
            self.end_headers()
            self.wfile.write(self.wrapper)
            return
        super().do_GET()

    def log_message(self, *args):
        # 요청 로그가 측정 결과를 덮지 않게 한다
        pass


def find_chrome(arg):
    for candidate in (
        arg,
        os.environ.get("CHROME_BIN"),
        MAC_CHROME,
        shutil.which("google-chrome"),
        shutil.which("chromium"),
    ):
        if candidate and Path(candidate).exists():
            return candidate
    return None


def measure(dist, slug, width, chrome):
    Handler.wrapper = (
        WRAPPER.replace("SLUG", slug)
        .replace("WIDTH", str(width))
        .replace("TOLERANCE", str(TOLERANCE_PX))
        .encode("utf-8")
    )
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(Handler, directory=str(dist))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}{PAGE}"
    profile = tempfile.mkdtemp(prefix="phone-check-")
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        f"--user-data-dir={profile}",
        # 분석 ID를 넣고 빌드한 dist라도 측정이 방문 기록으로 나가지 않게 로컬 서버 밖 주소를 막는다
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
        "--window-size=520,1000",
        f"--virtual-time-budget={VIRTUAL_TIME_MS}",
        "--dump-dom",
        url,
    ]
    try:
        try:
            dom = subprocess.run(
                cmd, capture_output=True, text=True, timeout=TIMEOUT_S
            ).stdout
        except subprocess.TimeoutExpired as e:
            dom = (e.stdout or b"").decode("utf-8", "replace")
    finally:
        # 시간 초과 때 남은 Chrome 도우미 프로세스까지 이 프로필로 찾아 끝낸다
        subprocess.run(["pkill", "-f", profile], capture_output=True)
        server.shutdown()
        if profile.startswith(tempfile.gettempdir()):
            shutil.rmtree(profile, ignore_errors=True)
    m = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
    text = html.unescape(m.group(1)) if m else ""
    try:
        return json.loads(text)
    except ValueError:
        return None


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("dist", help="pnpm build가 만든 dist 폴더")
    parser.add_argument("slug", help="글 slug (dist/posts/<slug>/index.html)")
    parser.add_argument("--width", type=int, default=390, help="잴 폭(px). 기본 390")
    parser.add_argument("--chrome", help="Chrome 실행 파일. 없으면 CHROME_BIN, macOS 기본 위치 순으로 찾는다")
    args = parser.parse_args(argv)

    dist = Path(args.dist).resolve()
    if not (dist / "posts" / args.slug / "index.html").is_file():
        print(f"측정하지 못함: {dist}/posts/{args.slug}/index.html이 없습니다. 블로그 저장소에서 pnpm build를 먼저 돌리세요")
        return 2
    chrome = find_chrome(args.chrome)
    if not chrome:
        print("측정하지 못함: Chrome을 찾지 못했습니다. --chrome으로 실행 파일을 넘기거나 CHROME_BIN을 설정하세요")
        return 2

    result = measure(dist, args.slug, args.width, chrome)
    if result is None:
        print(f"측정하지 못함: {TIMEOUT_S}초 안에 측정 결과가 나오지 않았습니다. 글 페이지가 열리는지 미리보기로 확인하세요")
        return 2
    print(f"폭 {args.width}px: scrollWidth {result['scrollWidth']}, 넘친 요소 {result['count']}개")
    for e in result["wide"]:
        print(f"  {e['tag']}.{e['cls']} 오른쪽 끝 {e['right']}px: {e['text']!r}")
    overflow = result["scrollWidth"] > args.width + TOLERANCE_PX or result["count"] > 0
    return 1 if overflow else 0


if __name__ == "__main__":
    sys.exit(main())
