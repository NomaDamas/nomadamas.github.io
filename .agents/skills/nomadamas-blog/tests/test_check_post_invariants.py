#!/usr/bin/env python3
"""check_post_invariants: 전후 비교의 오류와 경고, 금지 기호 검사 범위."""

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import check_post_invariants as cpi

ARROW = chr(0x2192)
MIDDLE_DOT = chr(0x00B7)

BASE = """---
title: "예시 글"
pubDatetime: 2026-09-30T14:10:00+09:00
---

도구를 설치하면 스킬 127개가 들어옵니다. 설치는 `claude plugin install`로 합니다.

![설치 화면](@/assets/images/demo/01-install.png)

```bash
claude plugin install demo@demo
```

자세한 내용은 [저장소](https://github.com/example/demo)에 있습니다.
"""


def run(*texts, published=False, commas=False):
    with tempfile.TemporaryDirectory() as tmp:
        paths = []
        for i, text in enumerate(texts):
            p = Path(tmp) / f"{i}.md"
            p.write_text(text, encoding="utf-8")
            paths.append(str(p))
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            flags = (["--published"] if published else []) + (["--commas"] if commas else [])
            code = cpi.main(flags + paths)
    return code, out.getvalue()


class CompareTests(unittest.TestCase):
    def test_identical_passes(self) -> None:
        code, out = run(BASE, BASE)
        self.assertEqual(code, 0)
        self.assertIn("통과", out)

    def test_prose_edit_keeps_facts(self) -> None:
        after = BASE.replace("도구를 설치하면", "설치하면")
        code, out = run(BASE, after)
        self.assertEqual(code, 0)
        self.assertIn("통과", out)

    def test_code_block_change_is_error(self) -> None:
        code, out = run(BASE, BASE.replace("demo@demo", "demo@other"))
        self.assertEqual(code, 1)
        self.assertIn("코드 블록", out)

    def test_frontmatter_value_change_is_error(self) -> None:
        code, out = run(BASE, BASE.replace("14:10", "15:00"))
        self.assertEqual(code, 1)
        self.assertIn("frontmatter pubDatetime 값", out)

    def test_frontmatter_prose_change_is_warning(self) -> None:
        code, out = run(BASE, BASE.replace('title: "예시 글"', 'title: "예시로 쓴 글"'))
        self.assertEqual(code, 0)
        self.assertIn("frontmatter title 문장", out)

    def test_banned_in_description_is_caught(self) -> None:
        text = BASE.replace(
            'title: "예시 글"', f'title: "예시 글"\ndescription: "설치 {ARROW} 사용"'
        )
        code, out = run(text)
        self.assertEqual(code, 1)
        self.assertIn("3행: 오른쪽 화살표", out)

    def test_image_change_is_error(self) -> None:
        code, out = run(BASE, BASE.replace("01-install.png", "02-install.png"))
        self.assertEqual(code, 1)
        self.assertIn("이미지 참조", out)

    def test_removed_number_is_warning(self) -> None:
        code, out = run(BASE, BASE.replace("스킬 127개가", "스킬이"))
        self.assertEqual(code, 0)
        self.assertIn("사라진 숫자: ['127']", out)

    def test_alt_text_edit_is_not_image_change(self) -> None:
        code, out = run(BASE, BASE.replace("![설치 화면]", "![플러그인 설치 화면]"))
        self.assertEqual(code, 0)

    def test_image_with_brackets_in_alt_text_is_tracked(self) -> None:
        before = BASE.replace("![설치 화면]", "![메일함. '[견적 요청] 오늘'은 영업]")
        code, out = run(before, before.replace("01-install.png", "04-inbox.png"))
        self.assertEqual(code, 1)
        self.assertIn("사라짐: ['@/assets/images/demo/01-install.png']", out)
        self.assertIn("생김: ['@/assets/images/demo/04-inbox.png']", out)

    def test_link_with_brackets_in_text_is_tracked(self) -> None:
        # https 주소는 URL 정규식이 따로 잡으므로 블로그 안 상대 주소로 본다
        before = BASE + "\n[[공지] 해커하우스 글](/posts/korea-hacker-house/)\n"
        code, out = run(before, before.replace("korea-hacker-house/", "hacker-house/"))
        self.assertEqual(code, 0)
        self.assertIn("사라진 링크 주소: ['/posts/korea-hacker-house/']", out)


class ConnectiveCommaTests(unittest.TestCase):
    def test_new_comma_after_connective_is_warning(self) -> None:
        before = BASE + "\n파일을 열고 내용을 봅니다.\n"
        code, out = run(before, before.replace("열고 내용", "열고, 내용"))
        self.assertEqual(code, 0)
        self.assertIn("새로 생긴 연결어미 뒤 쉼표: 16행 '열고,'", out)

    def test_existing_comma_is_left_alone(self) -> None:
        before = BASE + "\n파일을 열고, 내용을 봅니다.\n"
        code, out = run(before, before.replace("봅니다", "확인합니다"))
        self.assertEqual(code, 0)
        self.assertNotIn("연결어미", out)

    def test_nouns_and_conjunctions_are_not_connective(self) -> None:
        text = "\n개발자, 디자이너가 씁니다. 광고, 홍보도 합니다. 그리고, 하지만, 끝입니다.\n"
        code, out = run(BASE, BASE + text)
        self.assertEqual(code, 0)
        self.assertNotIn("연결어미", out)

    def test_contracted_and_copula_endings_are_caught(self) -> None:
        # 발행한 글 다섯 편에서 처음 목록이 놓친 꼴들이다
        words = ["생겨서", "줘서", "부탁하자", "규정인데", "파일이라", "보면서도"]
        after = BASE + "\n" + " ".join(f"{w}, 다음" for w in words) + "\n"
        code, out = run(BASE, after)
        self.assertEqual(code, 0)
        for w in words:
            self.assertIn(f"'{w},'", out)

    def test_words_shaped_like_endings_are_not_connective(self) -> None:
        text = "\n어서, 오세요. 아서, 왕입니다. 하자, 보수 기간입니다. 연구자, 개발자.\n"
        code, out = run(BASE, BASE + text)
        self.assertEqual(code, 0)
        self.assertNotIn("연결어미", out)

    def test_commas_option_lists_every_comma_with_context(self) -> None:
        text = BASE + "\n파일을 열고, 내용을 봅니다.\n\n개발자, 디자이너가 씁니다.\n\n보여 줘서, 압니다.\n"
        code, out = run(text, commas=True)
        self.assertEqual(code, 0)
        self.assertIn("16행: 파일을 열고, 내용을", out)
        self.assertIn("20행: 보여 줘서, 압니다", out)
        self.assertNotIn("18행", out)
        self.assertIn("연결어미 뒤 쉼표 2곳", out)

    def test_commas_option_takes_one_file(self) -> None:
        with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
            run(BASE, BASE, commas=True)

    def test_single_file_does_not_report_commas(self) -> None:
        code, out = run(BASE + "\n파일을 열고, 내용을 봅니다.\n")
        self.assertEqual(code, 0)
        self.assertNotIn("연결어미", out)


class BannedTests(unittest.TestCase):
    def test_banned_in_prose_reports_line(self) -> None:
        text = BASE.replace("합니다.", f"합니다 {ARROW} 끝.", 1)
        code, out = run(text)
        self.assertEqual(code, 1)
        self.assertIn("6행: 오른쪽 화살표", out)

    def test_banned_in_link_text_is_caught(self) -> None:
        code, out = run(BASE.replace("[저장소]", f"[저장소{MIDDLE_DOT}문서]"))
        self.assertEqual(code, 1)
        self.assertIn("가운뎃점", out)

    def test_banned_inside_code_is_allowed(self) -> None:
        text = BASE.replace("demo@demo", f"demo@demo  # a {ARROW} b").replace(
            "`claude plugin install`", f"`a {ARROW} b`"
        )
        code, _ = run(text)
        self.assertEqual(code, 0)

    def test_indented_fence_is_code(self) -> None:
        text = BASE + f"\n- 목록\n    ```text\n    a {ARROW} b\n    ```\n"
        code, _ = run(text)
        self.assertEqual(code, 0)


class SectionVisualTests(unittest.TestCase):
    def test_section_without_visual_warns(self) -> None:
        text = BASE + "\n## 목차\n\n## 행사란?\n\n글만 있다.\n\n## 저장소\n\n![배너](a.png)\n\n## 마치며\n\n끝.\n"
        code, out = run(text)
        self.assertEqual(code, 0)
        self.assertIn("'행사란?' 절에 이미지나 영상이 없습니다", out)
        self.assertNotIn("'저장소'", out)
        self.assertNotIn("'목차'", out)
        self.assertNotIn("'마치며'", out)

    def test_table_only_section_is_marked(self) -> None:
        _, out = run(BASE + "\n## 일정\n\n| 항목 | 내용 |\n|---|---|\n| 기간 | 사흘 |\n")
        self.assertIn("(표만 있음)", out)

    def test_image_with_brackets_in_alt_text_counts_as_visual(self) -> None:
        _, out = run(BASE + "\n## 메일함\n\n![메일함. '[견적 요청] 오늘'은 영업](a.png)\n")
        self.assertNotIn("'메일함' 절", out)

    def test_heading_inside_code_is_not_a_section(self) -> None:
        text = BASE + "\n## 시작하기\n\n![화면](a.png)\n\n```md\n## 코드 속 제목\n```\n"
        _, out = run(text)
        self.assertNotIn("코드 속 제목", out)


class TildeTests(unittest.TestCase):
    """기대값은 블로그의 markdown 처리기(remark-gfm)로 같은 원고를 렌더링해 확인한 결과다."""

    def test_two_tildes_on_a_line_warn(self) -> None:
        _, out = run(BASE + "\n6일~7일은 10시~17시입니다.\n")
        self.assertIn("짝이 맞는 물결표", out)

    def test_two_tildes_in_alt_text_warn(self) -> None:
        _, out = run(BASE + "\n![9월 16일~22일, 09:00~21:00](a.png)\n")
        self.assertIn("짝이 맞는 물결표", out)

    def test_one_tilde_and_inline_code_are_fine(self) -> None:
        _, out = run(BASE + "\n6일~8일에 열립니다. `a~b~c`\n")
        self.assertNotIn("물결표", out)

    def test_tildes_on_lines_of_one_paragraph_warn(self) -> None:
        for text in (
            "운영 시간은 10시~17시이고\n마지막 날은 10시~16시입니다.\n",
            "- 6일은 10시~17시이고\n  7일은 10시~16시입니다.\n",
            "> 6일은 10시~17시이고\n> 7일은 10시~16시입니다.\n",
        ):
            with self.subTest(text=text):
                _, out = run(BASE + "\n" + text)
                self.assertIn(f"{BASE.count(chr(10)) + 2}행에서 시작하는 문단", out)

    def test_two_tildes_in_one_table_cell_warn(self) -> None:
        _, out = run(BASE + "\n| 날짜 | 시간 |\n|---|---|\n| 6일 | 10시~17시, 10시~16시 |\n")
        self.assertIn("짝이 맞는 물결표", out)

    def test_tildes_in_separate_blocks_are_fine(self) -> None:
        for text in (
            "6일은 10시~17시입니다.\n\n7일은 10시~16시입니다.\n",
            "- 6일 10시~17시\n- 7일 10시~16시\n",
            "| 날짜 | 시간 |\n|---|---|\n| 6일~7일 | 10시~17시 |\n",
            "## 6일~7일\n\n10시~17시\n",
            "![6일 10시~17시](a.png)\n7일은 10시~16시\n",
        ):
            with self.subTest(text=text):
                _, out = run(BASE + "\n" + text)
                self.assertNotIn("물결표", out)

    def test_alt_text_with_brackets_pairs_only_inside(self) -> None:
        _, out = run(BASE + "\n![6일 10시~17시 '[공지] 일정'](a.png)\n7일은 10시~16시\n")
        self.assertNotIn("물결표", out)
        _, out = run(BASE + "\n![9월 16일~22일 '[공지]', 09:00~21:00](a.png)\n")
        self.assertIn("짝이 맞는 물결표", out)

    def test_tildes_that_cannot_pair_are_fine(self) -> None:
        for text in (
            '"~중 하나" 2곳과 "~고,"를 고쳤다\n',
            "비용(0.0001달러~1달러), 정확도(40%~80%)\n",
            "10% ~ 20%, 30% ~ 40%\n",
            "a~b와 c~~d\n",
        ):
            with self.subTest(text=text):
                _, out = run(BASE + "\n" + text)
                self.assertNotIn("물결표", out)


class PublishedTests(unittest.TestCase):
    def test_added_image_is_warning(self) -> None:
        code, out = run(BASE, BASE + "\n![배치도](b.png)\n", published=True)
        self.assertEqual(code, 0)
        self.assertIn("새로 넣은 이미지", out)

    def test_removed_image_is_error(self) -> None:
        after = BASE.replace("01-install.png", "02-install.png")
        code, out = run(BASE, after, published=True)
        self.assertEqual(code, 1)
        self.assertIn("발행본의 이미지가 사라졌습니다", out)

    def test_mod_datetime_is_warning(self) -> None:
        pub = "pubDatetime: 2026-09-30T14:10:00+09:00\n"
        after = BASE.replace(pub, pub + "modDatetime: 2026-10-01T10:00:00+09:00\n")
        code, out = run(BASE, after, published=True)
        self.assertEqual(code, 0)
        self.assertIn("modDatetime", out)

    def test_pub_datetime_change_is_still_error(self) -> None:
        code, _ = run(BASE, BASE.replace("14:10", "15:00"), published=True)
        self.assertEqual(code, 1)


if __name__ == "__main__":
    unittest.main()
