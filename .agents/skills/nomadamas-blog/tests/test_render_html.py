#!/usr/bin/env python3
"""render_html: Chrome 명령, PNG 완성 판정, 멈춘 Chrome 끝내기, 아래 여백 자르기.

실제 Chrome 대신 PNG를 쓴 뒤 끝나지 않는 가짜 Chrome으로 돈다. 여백 자르기는 Pillow가 있을 때만 돈다.
"""

import contextlib
import io
import os
import stat
import struct
import sys
import tempfile
import time
import unittest
import zlib
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import render_html as rh

try:
    from PIL import Image
except ImportError:
    Image = None


def png_bytes(w, h, rgb=(255, 255, 255)):
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return rh.PNG_HEAD + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


# 가짜 Chrome: --screenshot 경로에 PNG를 쓰고(모드에 따라) 끝나지 않고 기다린다. 자기 pid를 남긴다
FAKE_CHROME = """\
import sys, time
from pathlib import Path
mode, pid_file, png = sys.argv[1], Path(sys.argv[2]), bytes.fromhex(sys.argv[3])
args = dict(a.split("=", 1) for a in sys.argv[4:] if a.startswith("--") and "=" in a)
import os
pid_file.write_text(str(os.getpid()))
if mode == "exit-without-png":
    sys.exit(3)
if mode == "png-then-hang":
    Path(args["--screenshot"]).write_bytes(png)
time.sleep(60)
"""


class FakeChrome:
    def __init__(self, tmp, mode):
        self.tmp = Path(tmp)
        self.pid_file = self.tmp / f"{mode}.pid"
        script = self.tmp / "fake_chrome.py"
        script.write_text(FAKE_CHROME, encoding="utf-8")
        self.exe = self.tmp / f"chrome-{mode}"
        self.exe.write_text(
            f'#!/bin/sh\nexec "{sys.executable}" "{script}" {mode} "{self.pid_file}" {png_bytes(4, 3).hex()} "$@"\n',
            encoding="utf-8",
        )
        self.exe.chmod(self.exe.stat().st_mode | stat.S_IXUSR)

    def alive(self):
        pid = int(self.pid_file.read_text())
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return False
        return True


class CommandTests(unittest.TestCase):
    def test_chrome_command_sets_window_scale_profile_and_file_uri(self):
        cmd = rh.chrome_command("chrome", "a b/fig.html", "/t/raw.png", 1200, 630, 2.0, "/t/profile", 4000)
        self.assertIn("--window-size=1200,630", cmd)
        self.assertIn("--force-device-scale-factor=2", cmd)
        self.assertIn("--user-data-dir=/t/profile", cmd)
        self.assertIn("--screenshot=/t/raw.png", cmd)
        self.assertTrue(cmd[-1].startswith("file://") and cmd[-1].endswith("/a%20b/fig.html"))
        url = "https://github.com/NomaDamas/k-skill"
        self.assertEqual(rh.chrome_command("chrome", url, "/t/raw.png", 1280, 2400, 2, "/t/p", 6000)[-1], url)


class PngTests(unittest.TestCase):
    def test_png_is_complete_only_with_iend(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x.png"
            self.assertFalse(rh.png_complete(path))
            data = png_bytes(5, 4)
            path.write_bytes(data[:-12])
            self.assertFalse(rh.png_complete(path))
            path.write_bytes(data)
            self.assertTrue(rh.png_complete(path))
            self.assertEqual(rh.png_size(path), (5, 4))

    def test_crop_height_keeps_pad_inside_image(self):
        self.assertEqual(rh.crop_height(1000, 400, 60), 460)
        self.assertEqual(rh.crop_height(1000, 980, 60), 1000)


class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.raw = self.dir / "raw.png"
        self.profile = self.dir / "profile"

    def tearDown(self):
        self.tmp.cleanup()

    def run_fake(self, mode, timeout):
        self.fake = FakeChrome(self.dir, mode)
        cmd = rh.chrome_command(str(self.fake.exe), self.dir / "fig.html", self.raw, 10, 10, 2, self.profile, 0)
        started = time.monotonic()
        try:
            rh.capture(cmd, self.raw, self.profile, timeout)
        finally:
            self.elapsed = time.monotonic() - started

    def test_stops_chrome_that_hangs_after_writing_png(self):
        self.run_fake("png-then-hang", timeout=20)
        self.assertLess(self.elapsed, 10)
        self.assertTrue(rh.png_complete(self.raw))
        self.assertFalse(self.fake.alive())

    def test_reports_chrome_that_exits_without_png(self):
        with self.assertRaises(rh.RenderError) as ctx:
            self.run_fake("exit-without-png", timeout=20)
        self.assertIn("PNG 없이 끝났습니다", str(ctx.exception))

    def test_sweep_skips_short_profile_path(self):
        done = mock.Mock(poll=mock.Mock(return_value=0))
        with mock.patch.object(rh.subprocess, "run") as run:
            for profile in ("", "/", "/tmp/profile", "profile", "/Users/someone/Dev/project"):
                rh.stop(done, profile)
            run.assert_not_called()
            rh.stop(done, self.profile)
            run.assert_called_once()

    def test_times_out_and_stops_chrome_that_never_writes(self):
        with self.assertRaises(rh.RenderError) as ctx:
            self.run_fake("hang", timeout=1)
        self.assertIn("1초 안에", str(ctx.exception))
        self.assertFalse(self.fake.alive())


@unittest.skipUnless(Image, "Pillow가 없어 건너뜀: uv run --with pillow python3 -m unittest ...")
class TrimTests(unittest.TestCase):
    def make(self, height, box_rows, noise=False):
        im = Image.new("RGB", (100, height), (255, 255, 255))
        for y in range(*box_rows):
            for x in range(10, 60):
                im.putpixel((x, y), (20, 20, 20))
        if noise:
            im.putpixel((80, height - 5), (250, 251, 252))
        return im

    def trim(self, im, pad):
        with tempfile.TemporaryDirectory() as tmp:
            raw, out = Path(tmp) / "raw.png", Path(tmp) / "out.png"
            im.save(raw)
            size = rh.trim(raw, out, pad)
            with Image.open(out) as saved:
                return size, saved.size

    def test_cuts_bottom_margin_and_ignores_near_background_noise(self):
        size, saved = self.trim(self.make(300, (10, 50), noise=True), pad=20)
        self.assertEqual(size, (100, 70))
        self.assertEqual(saved, (100, 70))

    def test_rejects_picture_touching_window_bottom(self):
        with self.assertRaises(rh.RenderError) as ctx:
            self.trim(self.make(120, (10, 120)), pad=20)
        self.assertIn("--max-height", str(ctx.exception))

    def test_rejects_blank_picture(self):
        with self.assertRaises(rh.RenderError) as ctx:
            self.trim(self.make(120, (0, 0)), pad=20)
        self.assertIn("배경색뿐", str(ctx.exception))


class MainTests(unittest.TestCase):
    def run_main(self, *argv):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = rh.main(list(argv))
        return code, out.getvalue()

    def test_input_errors_explain_fix(self):
        with tempfile.TemporaryDirectory() as tmp:
            html = Path(tmp) / "fig.html"
            out = str(Path(tmp) / "out.png")
            code, msg = self.run_main(str(html), out)
            self.assertEqual(code, 2)
            self.assertIn("HTML 파일이 없습니다", msg)
            html.write_text("<p>x</p>", encoding="utf-8")
            code, msg = self.run_main(str(html), out, "--chrome", str(Path(tmp) / "없는-chrome"))
            self.assertIn("--chrome 경로", msg)
            code, msg = self.run_main(str(html), out, "--chrome", sys.executable, "--max-height", "20000")
            self.assertIn("16000px", msg)
            code, msg = self.run_main(str(html), out, "--chrome", sys.executable, "--height", "0")
            self.assertIn("0보다 크고", msg)

    def test_fixed_height_copies_png_from_fake_chrome(self):
        with tempfile.TemporaryDirectory() as tmp:
            html = Path(tmp) / "fig.html"
            html.write_text("<p>x</p>", encoding="utf-8")
            fake = FakeChrome(tmp, "png-then-hang")
            out = Path(tmp) / "sub" / "00-cover.png"
            code, msg = self.run_main(str(html), str(out), "--chrome", str(fake.exe), "--height", "630")
            self.assertEqual(code, 0, msg)
            self.assertEqual(msg.strip(), f"{out} 4x3")
            self.assertFalse(fake.alive())


if __name__ == "__main__":
    unittest.main()
