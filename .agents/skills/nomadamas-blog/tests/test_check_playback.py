#!/usr/bin/env python3
"""check_playback: 측정 결과를 통과와 실패로 나누는 기준. Chrome은 띄우지 않는다."""

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import check_playback as cpb


def video(name, play="ok", advanced=2.0, audio=1000, muted=False, state=(1, 4)):
    return {
        "src": f"http://127.0.0.1/videos/{name}",
        "mutedAttr": muted,
        "networkState": state[0],
        "readyState": state[1],
        "error": None if play == "ok" else 4,
        "play": play,
        "advanced": advanced,
        "audioBytes": audio,
    }


class PlaybackReportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dist = Path(self.tmp.name)
        (self.dist / "posts" / "demo").mkdir(parents=True)
        (self.dist / "posts" / "demo" / "index.html").write_text("<html></html>")
        (self.dist / "index.html").write_text("<html></html>")

    def tearDown(self):
        self.tmp.cleanup()

    def report(self, result, *extra):
        out = io.StringIO()
        with (
            mock.patch.object(cpb, "find_chrome", return_value="chrome"),
            mock.patch.object(cpb, "run", return_value=result) as run,
            contextlib.redirect_stdout(out),
        ):
            code = cpb.main([str(self.dist), "demo", *extra])
        return code, out.getvalue(), run

    def test_played_videos_pass_and_report_sound(self):
        result = {"path": "/posts/demo/", "videos": [video("a.mp4"), video("b.mp4", audio=0, muted=True)]}
        code, out, _ = self.report(result)
        self.assertEqual(code, 0, out)
        self.assertIn("a.mp4 소리 있음, muted 없음", out)
        self.assertIn("b.mp4 소리 없음, muted 있음", out)

    def test_video_that_did_not_load_after_navigation_fails(self):
        dead = video("a.mp4", play="NotSupportedError", advanced=0, audio=0, muted=True, state=(3, 0))
        code, out, _ = self.report({"path": "/posts/demo/", "videos": [dead]})
        self.assertEqual(code, 1)
        self.assertIn("networkState 3", out)
        self.assertIn("소리 확인 못 함", out)

    def test_sound_hidden_by_muted_fails(self):
        code, out, _ = self.report({"path": "/posts/demo/", "videos": [video("a.mp4", muted=True)]})
        self.assertEqual(code, 1)
        self.assertIn("소리가 있는데 muted", out)

    def test_cannot_measure_cases(self):
        self.assertEqual(self.report(None)[0], 2)
        code, out, _ = self.report({"error": "reload"})
        self.assertEqual(code, 2)
        self.assertIn("새로 불렀습니다", out)
        code, out, run = self.report({"path": "/", "videos": []}, "--from", "posts")
        self.assertEqual(code, 2)
        self.assertIn("/posts/", out)
        run.assert_not_called()

    def test_start_page_is_normalized(self):
        (self.dist / "posts" / "index.html").write_text("<html></html>")
        _, _, run = self.report({"path": "/posts/demo/", "videos": []}, "--from", "posts")
        self.assertEqual(run.call_args.args[2], "/posts/")


if __name__ == "__main__":
    unittest.main()
