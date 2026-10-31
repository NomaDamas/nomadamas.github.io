#!/usr/bin/env python3
"""check_cross_post: 다른 글과 겹치는 문장, 공통 문구 빼기, 이미지와 짧은 줄 무시."""

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import check_cross_post as ccp

COMMON = "이 글은 AI의 도움을 받아 작성했고 화면과 수치는 직접 확인했습니다."
TEMPLATE = "해커하우스라는 말이 낯설다면 개발 좋아하는 사람들의 하숙집을 떠올리면 됩니다."


def post(*lines):
    return "---\ntitle: \"제목\"\n---\n\n" + "\n\n".join(lines) + "\n"


class CrossPostTest(unittest.TestCase):
    def run_check(self, files, target="a.md", *extra):
        with tempfile.TemporaryDirectory() as d:
            for name, text in files.items():
                Path(d, name).write_text(text, encoding="utf-8")
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = ccp.main([str(Path(d, target)), *extra])
            return code, out.getvalue()

    def test_template_sentence_is_found(self):
        code, out = self.run_check(
            {
                "a.md": post("오늘은 새 도구를 소개합니다. " + TEMPLATE),
                "b.md": post(TEMPLATE),
                "c.md": post("전혀 다른 이야기를 길게 이어 가는 문장이 여기에 있습니다."),
                "d.md": post("또 다른 글의 본문은 이렇게 아무 관련 없는 내용입니다."),
            }
        )
        self.assertEqual(code, 1)
        self.assertIn("b.md", out)
        self.assertIn("겹치는 문장 1곳", out)

    def test_common_notice_is_counted_not_reported(self):
        files = {f"{n}.md": post(COMMON) for n in "abcde"}
        code, out = self.run_check(files)
        self.assertEqual(code, 0)
        self.assertIn("공통 문구 1개", out)

    def test_image_alt_and_link_only_lines_are_ignored(self):
        alt = "![" + TEMPLATE + "](@/assets/x.jpg)"
        code, out = self.run_check(
            {
                "a.md": post(alt, "**GitHub**: [github.com/org/aaa](https://github.com/org/aaa)"),
                "b.md": post(alt, "**GitHub**: [github.com/org/bbb](https://github.com/org/bbb)"),
            }
        )
        self.assertEqual(code, 0, out)

    def test_threshold_keeps_same_frame_with_other_numbers_out(self):
        a = "공개 저장소 90개가 받은 star는 모두 12,148개입니다(2026년 10월 7일 기준)."
        b = "지금 공개 저장소는 91개이고 star는 모두 12,267개입니다(2026년 10월 13일 기준)."
        files = {"a.md": post(a), "b.md": post(b)}
        self.assertEqual(self.run_check(files)[0], 0)
        self.assertEqual(self.run_check(files, "a.md", "--threshold", "0.7")[0], 1)


if __name__ == "__main__":
    unittest.main()
