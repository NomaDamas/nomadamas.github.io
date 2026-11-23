#!/usr/bin/env python3
"""check_live: 빌드가 바꾼 둥근 따옴표와 원고의 곧은 따옴표를 같은 문구로 본다."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import check_live as cl


class QuoteTest(unittest.TestCase):
    def test_curly_quotes_match_manuscript_quotes(self):
        body = cl.plain(cl.text_of("<p>첫 회인 ‘변기톤’에서는 “토큰”을</p>"))
        self.assertIn(cl.plain("첫 회인 '변기톤'에서는"), body)
        self.assertIn(cl.plain('"토큰"을'), body)
        self.assertNotIn(cl.plain("'변기톤'을 열었습니다"), body)


class ManuscriptTest(unittest.TestCase):
    def test_counts_iframe_embeds_apart_from_videos(self):
        import tempfile

        text = (
            '---\ntitle: "글"\n---\n'
            "![사진](a.jpg)\n\n"
            '<iframe src="https://www.youtube-nocookie.com/embed/x"></iframe>\n\n'
            '<video src="b.mp4" controls></video>\n\n'
            "```html\n<iframe src=\"코드 블록 안은 세지 않는다\"></iframe>\n```\n"
        )
        with tempfile.NamedTemporaryFile("w", suffix=".md", encoding="utf-8", delete=False) as f:
            f.write(text)
        self.assertEqual(cl.manuscript(f.name), ("글", 1, 1, 1))
        Path(f.name).unlink()


if __name__ == "__main__":
    unittest.main()
