#!/usr/bin/env python3
"""빌드한 블로그에서 다른 페이지를 거쳐 글로 들어갔을 때 본문 영상이 재생되는지 본다.

사용:
  check_playback.py <dist 폴더> <slug> [--from /] [--chrome <Chrome 실행 파일>]

블로그는 페이지를 옮길 때 새로 부르지 않고 본문만 바꿔 끼운다. 그렇게 들어온 글의 영상은
새로 고침으로 연 글과 달리 재생되지 않을 수 있어, 주소를 직접 여는 확인으로는 놓친다.
이 스크립트는 --from 페이지를 열고 글 링크를 눌러 들어간 뒤, 본문 영상마다 아래를 잰다.

  - 불러온 상태(networkState, readyState)와 오류
  - 소리를 끈 채 2초 재생해 재생 위치가 움직였는지
  - 디코딩한 소리 바이트. 0이면 소리 트랙이 없다
  - muted 속성. 소리가 있는데 muted면 독자는 소리가 없는 영상으로 본다

dist를 임시 로컬 서버(127.0.0.1)로 띄우고 같은 출처의 측정 페이지에서 iframe으로 연다.
측정 페이지는 메모리에서 내보내므로 dist에 파일을 쓰지 않는다.

headless Chrome의 가상 시간(--virtual-time-budget)에서는 화면 전환 효과의 콜백과 영상 재생이
끝나지 않는다. 실제 시간으로 돌리고, 측정 페이지가 결과를 서버로 보낼 때까지 서버가 페이지
로딩 완료(= Chrome의 DOM 출력과 종료)를 붙잡아 둔다.

종료 코드: 0 모두 재생, 1 재생되지 않는 영상이나 소리가 있는데 muted인 영상이 있음, 2 측정하지 못함
"""

import argparse
import functools
import json
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from check_phone_width import PAGE, Handler, find_chrome

WAIT = "/__playback_wait"
RESULT = "/__playback_result"
# 페이지 이동, 영상마다 메타데이터와 2초 재생을 기다리는 실제 시간
TIMEOUT_S = 60

WRAPPER = """<!doctype html><html><body style="margin:0">
<iframe id="f" src="FROM" style="width:1000px;height:900px;border:0"></iframe>
<img src="WAIT" alt="" style="display:none">
<script>
const out = v => fetch('RESULT', {method: 'POST', body: JSON.stringify(v)});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const f = document.getElementById('f');
let started = false;
f.addEventListener('load', () => {
  if (started) return;
  started = true;
  const w = f.contentWindow, d = f.contentDocument;
  // 새로 불러오면 window가 바뀌어 이 표시가 사라진다
  w.__clientNav = true;
  let arrived = false;
  d.addEventListener('astro:page-load', async () => {
    if (arrived) return;
    arrived = true;
    if (!w.__clientNav) { out({error: 'reload'}); return; }
    await sleep(1500);
    const rows = [];
    for (const v of f.contentDocument.querySelectorAll('article video')) {
      const row = {
        src: v.currentSrc || v.getAttribute('src') || '',
        mutedAttr: v.hasAttribute('muted'),
        networkState: v.networkState,
        readyState: v.readyState,
        error: v.error ? v.error.code : null,
      };
      v.muted = true;
      const t0 = v.currentTime;
      row.play = await Promise.race([
        v.play().then(() => 'ok', e => String(e.name)),
        sleep(5000).then(() => 'timeout'),
      ]);
      await sleep(2000);
      v.pause();
      row.advanced = v.currentTime - t0;
      row.audioBytes = v.webkitAudioDecodedByteCount ?? null;
      rows.push(row);
    }
    out({path: w.location.pathname, videos: rows});
  });
  const a = d.createElement('a');
  a.href = '/posts/SLUG/';
  a.textContent = 'go';
  d.body.appendChild(a);
  a.click();
  setTimeout(() => { if (!arrived) out({error: 'timeout'}); }, 10000);
});
</script></body></html>"""


class PlaybackHandler(Handler):
    done = None
    result = None

    def send_body(self, code, body=b"", kind="text/plain"):
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == WAIT:
            self.done.wait(TIMEOUT_S)
            self.send_body(204)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != RESULT:
            self.send_body(404)
            return
        size = int(self.headers.get("Content-Length") or 0)
        type(self).result = self.rfile.read(size)
        self.send_body(204)
        self.done.set()


def run(dist, slug, start, chrome):
    wrapper = (
        WRAPPER.replace("FROM", start)
        .replace("SLUG", slug)
        .replace("WAIT", WAIT)
        .replace("RESULT", RESULT)
        .encode("utf-8")
    )
    handler = type(
        "Handler",
        (PlaybackHandler,),
        {"wrapper": wrapper, "done": threading.Event()},
    )
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(handler, directory=str(dist))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}{PAGE}"
    profile = tempfile.mkdtemp(prefix="playback-check-")
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        f"--user-data-dir={profile}",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
        # 소리 장치가 없는 headless에서는 이 옵션이 없으면 재생 위치가 움직이지 않는다
        "--disable-audio-output",
        "--autoplay-policy=no-user-gesture-required",
        "--dump-dom",
        url,
    ]
    try:
        try:
            subprocess.run(cmd, capture_output=True, timeout=TIMEOUT_S + 15)
        except subprocess.TimeoutExpired:
            pass
    finally:
        subprocess.run(["pkill", "-f", profile], capture_output=True)
        handler.done.set()
        server.shutdown()
        if profile.startswith(tempfile.gettempdir()):
            shutil.rmtree(profile, ignore_errors=True)
    try:
        return json.loads(handler.result) if handler.result else None
    except ValueError:
        return None


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("dist", help="pnpm build가 만든 dist 폴더")
    parser.add_argument("slug", help="글 slug (dist/posts/<slug>/index.html)")
    parser.add_argument(
        "--from", dest="start", default="/", help="먼저 열 페이지(dist 안의 폴더 주소). 기본 /"
    )
    parser.add_argument("--chrome", help="Chrome 실행 파일. 없으면 CHROME_BIN, macOS 기본 위치 순으로 찾는다")
    args = parser.parse_args(argv)

    dist = Path(args.dist).resolve()
    if not (dist / "posts" / args.slug / "index.html").is_file():
        print(f"측정하지 못함: {dist}/posts/{args.slug}/index.html이 없습니다. 블로그 저장소에서 pnpm build를 먼저 돌리세요")
        return 2
    start = "/" + args.start.strip("/") + "/" if args.start.strip("/") else "/"
    if not (dist / start.strip("/") / "index.html").is_file():
        print(f"측정하지 못함: 시작 페이지 {start}의 index.html이 dist에 없습니다")
        return 2
    chrome = find_chrome(args.chrome)
    if not chrome:
        print("측정하지 못함: Chrome을 찾지 못했습니다. --chrome으로 실행 파일을 넘기거나 CHROME_BIN을 설정하세요")
        return 2

    result = run(dist, args.slug, start, chrome)
    if result is None:
        print(f"측정하지 못함: {TIMEOUT_S}초 안에 결과가 오지 않았습니다")
        return 2
    if "error" in result:
        reason = {
            "reload": "링크를 눌렀더니 페이지를 새로 불렀습니다. 클라이언트 이동을 쓰지 않는 페이지면 이 확인이 필요 없습니다",
            "timeout": "링크를 누른 뒤 글 페이지가 열리지 않았습니다",
        }.get(result["error"], result["error"])
        print(f"측정하지 못함: {reason}")
        return 2

    videos = result["videos"]
    print(f"{start} -> {result['path']} 클라이언트 이동, 본문 영상 {len(videos)}개")
    bad = 0
    for v in videos:
        played = v["play"] == "ok" and v["advanced"] > 0.5
        audio = v["audioBytes"]
        # 재생하지 못한 영상은 디코딩한 소리도 0이라 소리 유무를 말할 수 없다
        if audio is None or not played:
            sound = "소리 확인 못 함"
        else:
            sound = "소리 있음" if audio > 0 else "소리 없음"
        problems = []
        if not played:
            problems.append(
                f"재생 안 됨(play {v['play']}, networkState {v['networkState']}, "
                f"readyState {v['readyState']}, error {v['error']})"
            )
        if audio and v["mutedAttr"]:
            problems.append("소리가 있는데 muted 속성이 있음")
        bad += bool(problems)
        state = ", ".join(problems) if problems else f"재생 {v['advanced']:.1f}초 진행"
        mark = "실패" if problems else "통과"
        muted = "있음" if v["mutedAttr"] else "없음"
        print(f"  {mark}: {Path(v['src']).name} {sound}, muted {muted}, {state}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
