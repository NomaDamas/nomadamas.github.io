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


if __name__ == "__main__":
    unittest.main()
