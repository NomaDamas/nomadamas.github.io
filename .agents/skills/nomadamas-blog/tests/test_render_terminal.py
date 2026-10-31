#!/usr/bin/env python3
"""render_terminal: ANSI 해석, 표시 폭, 강조 상자 위치, HTML 생성. Chrome 없이 돈다."""

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import render_terminal as rt

ESC = "\x1b"


class ParseLineTests(unittest.TestCase):
    def test_basic_color_then_reset(self) -> None:
        cells = rt.parse_line(f"{ESC}[31mab{ESC}[0mc")
        self.assertEqual([c for c, _ in cells], ["a", "b", "c"])
        self.assertEqual(cells[0][1]["fg"], rt.BASIC[1])
        self.assertIsNone(cells[2][1]["fg"])

    def test_256_and_truecolor(self) -> None:
        cells = rt.parse_line(f"{ESC}[38;5;196mX{ESC}[38;2;1;2;3mY")
        self.assertEqual(cells[0][1]["fg"], "#ff0000")
        self.assertEqual(cells[1][1]["fg"], "#010203")

    def test_non_color_escapes_are_dropped(self) -> None:
        self.assertEqual(rt.plain(f"{ESC}[2Kab{ESC}]0;title\x07c"), "abc")


class WidthTests(unittest.TestCase):
    def test_hangul_is_two_columns(self) -> None:
        self.assertEqual(rt.width("한"), 2)
        self.assertEqual(rt.width("a"), 1)
        self.assertEqual(rt.dwidth("한a"), 3)


class ResolveBoxTests(unittest.TestCase):
    def test_find_uses_display_width(self) -> None:
        box = rt.resolve_box(
            {"r0": 0, "r1": 0, "find": "local scope"}, ["  설치 local scope"]
        )
        self.assertEqual((box["c0"], box["c1"]), (7, 18))

    def test_missing_find_explains_row(self) -> None:
        with self.assertRaises(rt.SpecError) as ctx:
            rt.resolve_box({"r0": 0, "r1": 0, "find": "없는 글자"}, ["hello"])
        self.assertIn("hello", str(ctx.exception))

    def test_row_out_of_range(self) -> None:
        with self.assertRaises(rt.SpecError):
            rt.resolve_box({"r0": 3, "r1": 3}, ["a", "b"])

    def test_unknown_color(self) -> None:
        with self.assertRaises(rt.SpecError):
            rt.resolve_box({"r0": 0, "r1": 0, "color": "blue"}, ["a"])


class MakeHtmlTests(unittest.TestCase):
    def test_bar_box_and_label_from_relative_src(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / "caps").mkdir()
            (base / "caps" / "01.ansi").write_text(
                f"$ install\n{ESC}[32mok{ESC}[0m done\n", encoding="utf-8"
            )
            spec = {
                "name": "01",
                "src": "caps/01.ansi",
                "rows": [0, 1],
                "boxes": [
                    {
                        "r0": 1,
                        "r1": 1,
                        "find": "ok",
                        "kind": "bar",
                        "color": "red",
                        "label": "문제",
                    }
                ],
            }
            doc, page_w, page_h = rt.make_html(spec, base)
        self.assertIn("border-left:4px solid #f85149", doc)
        self.assertIn(">문제</div>", doc)
        self.assertGreater(page_w, 380)
        self.assertEqual(page_h, rt.PAD * 2 + 2 * rt.LH + 40)

    def test_rows_past_capture_end(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / "a.ansi").write_text("one\ntwo\n", encoding="utf-8")
            with self.assertRaises(rt.SpecError):
                rt.make_html({"name": "x", "src": "a.ansi", "rows": [0, 5]}, base)


class RowsCommandTests(unittest.TestCase):
    def test_prints_numbered_non_empty_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "a.ansi"
            path.write_text(f"first\n\n{ESC}[1mthird{ESC}[0m\n", encoding="utf-8")
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                rt.main(["rows", str(path)])
        self.assertEqual(out.getvalue().splitlines(), ["  0| first", "  2| third"])


if __name__ == "__main__":
    unittest.main()
