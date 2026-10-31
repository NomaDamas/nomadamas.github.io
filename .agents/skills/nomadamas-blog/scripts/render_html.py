#!/usr/bin/env python3
"""HTML로 만든 그림(표지, 구조 그림, 시연 상황 그림)과 공개 웹 페이지를 블로그용 PNG로 찍는다.

headless Chrome으로 찍는다. --height를 주면 그 크기 그대로 찍고, 주지 않으면
넉넉한 창으로 찍은 뒤 아래쪽 빈 여백을 잘라 낸다. 여백 색은 오른쪽 아래 픽셀로 정한다.
headless Chrome은 PNG를 다 쓴 뒤에도 끝나지 않을 때가 있어, PNG가 끝까지 써지면 바로 끝낸다.

사용:
  render_html.py edit/cover.html out/00-cover.png --width 1200 --height 630   표지(2400x1260)
  render_html.py edit/scenario.html out/04-scenario.png                        설명 그림(폭 1100, 아래 여백 자름)
  render_html.py https://github.com/<org>/<repo> caps/repo.png --width 1280 --height 2400 --wait-ms 6000

크기는 CSS 픽셀이고 PNG는 --scale배(기본 2)로 나온다.
아래 여백을 자를 때는 Pillow가 필요하다: uv run --with pillow python3 render_html.py ...
"""

import argparse
import contextlib
import os
import shutil
import signal
import struct
import subprocess
import sys
import tempfile
import time
from pathlib import Path

DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PNG_HEAD = b"\x89PNG\r\n\x1a\n"
PNG_END = b"IEND\xaeB`\x82"  # 마지막 IEND 청크의 이름과 CRC. 이게 보이면 PNG를 끝까지 쓴 것이다
MAX_WINDOW = 16000  # 창 높이가 이보다 크면 headless Chrome 렌더링이 멈춘다
TOLERANCE = 6  # 배경과 이만큼 이하로 다른 픽셀은 배경으로 본다(압축 잡음)
POLL = 0.2


class RenderError(Exception):
    """찍지 못했거나 결과가 이상하다. 메시지에 고칠 방법을 담는다."""


def is_url(target):
    return str(target).startswith(("http://", "https://"))


def chrome_command(chrome, html, raw, width, height, scale, profile, wait_ms):
    page = str(html) if is_url(html) else Path(html).resolve().as_uri()
    return [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        f"--user-data-dir={profile}",
        f"--window-size={width},{height}",
        f"--force-device-scale-factor={scale:g}",
        f"--virtual-time-budget={wait_ms}",
        f"--screenshot={raw}",
        page,
    ]


def png_complete(path):
    try:
        with open(path, "rb") as f:
            head = f.read(len(PNG_HEAD))
            f.seek(0, os.SEEK_END)
            if f.tell() < len(PNG_HEAD) + len(PNG_END):
                return False
            f.seek(-len(PNG_END), os.SEEK_END)
            return head == PNG_HEAD and f.read() == PNG_END
    except FileNotFoundError:
        return False


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    if head[:8] != PNG_HEAD:
        raise RenderError(f"PNG가 아닙니다: {path}")
    return struct.unpack(">II", head[16:24])


def stop(proc, profile):
    """Chrome과 도우미 프로세스를 끝낸다. 도우미는 같은 프로세스 그룹이나 임시 프로필 경로로 찾는다."""
    if proc.poll() is None:
        with contextlib.suppress(ProcessLookupError):
            os.killpg(proc.pid, signal.SIGTERM)
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(proc.pid, signal.SIGKILL)
            proc.wait()
    # 빈 값이나 넓은 경로로 pkill -f를 부르면 상관없는 프로세스까지 끝낸다. 임시 폴더 아래 profile 경로일 때만 쓴다
    p = Path(profile)
    if p.is_absolute() and p.name == "profile" and len(p.parts) > 3:
        subprocess.run(["pkill", "-f", str(p)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def capture(cmd, raw, profile, timeout):
    """cmd로 Chrome을 띄워 raw에 PNG가 끝까지 써지기를 기다린 뒤 Chrome을 끝낸다."""
    try:
        proc = subprocess.Popen(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True
        )
    except OSError as e:
        raise RenderError(f"Chrome을 띄우지 못했습니다: {e}. --chrome 경로를 확인하세요")
    try:
        deadline = time.monotonic() + timeout
        while not png_complete(raw):
            if proc.poll() is not None and not png_complete(raw):
                raise RenderError(
                    f"Chrome이 PNG 없이 끝났습니다(종료 코드 {proc.returncode}). HTML을 브라우저로 열어 그려지는지 보세요"
                )
            if time.monotonic() > deadline:
                raise RenderError(
                    f"Chrome이 {timeout}초 안에 PNG를 쓰지 못했습니다. --timeout을 늘리거나 HTML의 외부 자원을 확인하세요"
                )
            time.sleep(POLL)
    finally:
        stop(proc, profile)


def content_bottom(im, tolerance=TOLERANCE):
    """배경(오른쪽 아래 픽셀)과 다른 픽셀이 있는 마지막 행 다음 번호. 배경뿐이면 0."""
    from PIL import Image, ImageChops

    rgb = im.convert("RGB")
    bg = rgb.getpixel((rgb.width - 1, rgb.height - 1))
    diff = ImageChops.difference(rgb, Image.new("RGB", rgb.size, bg))
    box = diff.point(lambda v: 255 if v > tolerance else 0).getbbox()
    return box[3] if box else 0


def crop_height(height, bottom, pad):
    return min(height, bottom + pad)


def trim(raw, out, pad):
    from PIL import Image

    with Image.open(raw) as im:
        rgb = im.convert("RGB")
    bottom = content_bottom(rgb)
    if bottom == 0:
        raise RenderError("찍힌 화면이 배경색뿐입니다. HTML을 브라우저로 열어 그려지는지 보세요")
    if bottom >= rgb.height:
        raise RenderError(
            "그림이 창 아래 끝까지 찼습니다. 잘렸을 수 있으니 --max-height를 늘리거나 --height로 높이를 정하세요"
        )
    keep = crop_height(rgb.height, bottom, pad)
    rgb.crop((0, 0, rgb.width, keep)).save(out, optimize=True)
    return rgb.width, keep


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("html", help="찍을 HTML 파일이나 http(s) 주소")
    parser.add_argument("out", type=Path, help="만들 PNG 경로. 폴더가 없으면 만든다")
    parser.add_argument("--width", type=int, default=1100, help="창 폭(CSS px, 기본 1100)")
    parser.add_argument("--height", type=int, help="창 높이(CSS px). 주면 그 크기 그대로 찍고 여백을 자르지 않는다")
    parser.add_argument("--scale", type=float, default=2, help="화면 배율(기본 2)")
    parser.add_argument("--pad", type=int, default=30, help="여백을 자를 때 그림 아래에 남길 높이(CSS px, 기본 30)")
    parser.add_argument("--max-height", type=int, default=4000, help="여백을 자를 때 찍는 창 높이(CSS px, 기본 4000)")
    parser.add_argument("--wait-ms", type=int, default=4000, help="찍기 전에 글꼴과 스크립트를 기다릴 시간(ms, 기본 4000)")
    parser.add_argument("--timeout", type=float, default=30, help="PNG를 기다릴 최대 초(기본 30)")
    parser.add_argument("--chrome", help="Chrome 실행 파일. 없으면 CHROME_BIN, 그다음 macOS 기본 위치")
    args = parser.parse_args(argv)

    try:
        if not is_url(args.html) and not Path(args.html).is_file():
            raise RenderError(f"HTML 파일이 없습니다: {args.html}")
        chrome = args.chrome or os.environ.get("CHROME_BIN") or DEFAULT_CHROME
        if not Path(chrome).exists():
            raise RenderError(f"Chrome을 찾지 못했습니다: {chrome}. --chrome 경로나 CHROME_BIN 환경변수를 주세요")
        window_h = args.max_height if args.height is None else args.height
        if min(args.width, window_h, args.scale) <= 0 or args.pad < 0:
            raise RenderError("--width, --height, --max-height, --scale은 0보다 크고 --pad는 0 이상이어야 합니다")
        if window_h > MAX_WINDOW:
            raise RenderError(f"창 높이 {window_h}px가 {MAX_WINDOW}px를 넘습니다. 그보다 높으면 렌더링이 멈춥니다")
        if args.height is None:
            try:
                import PIL  # noqa: F401
            except ImportError:
                raise RenderError(
                    "아래 여백을 자르려면 Pillow가 필요합니다. uv run --with pillow python3 render_html.py ... 로 실행하거나 --height를 주세요"
                )
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="render-html-", ignore_cleanup_errors=True) as tmp:
            profile = Path(tmp) / "profile"
            raw = Path(tmp) / "raw.png"
            cmd = chrome_command(chrome, args.html, raw, args.width, window_h, args.scale, profile, args.wait_ms)
            capture(cmd, raw, profile, args.timeout)
            if args.height is not None:
                shutil.copyfile(raw, args.out)
                size = png_size(args.out)
            else:
                size = trim(raw, args.out, round(args.pad * args.scale))
    except RenderError as e:
        print(f"오류: {e}", file=sys.stderr)
        return 2
    print(f"{args.out} {size[0]}x{size[1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
