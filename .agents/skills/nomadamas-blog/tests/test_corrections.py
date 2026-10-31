#!/usr/bin/env python3
"""corrections: 저장 전 검증, 중복 막기, hit의 다음 단계, check 범위, brief와 review 출력."""

import contextlib
import io
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import corrections as cor

POST = """---
title: "모델은 고릅니다"
pubDatetime: 2026-09-30T14:10:00+09:00
---

모델은 클라우드 모델과 로컬 모델 중에서 고릅니다.

`고릅니다`는 코드라서 보지 않습니다.

```text
여기서도 고릅니다
```

[링크](https://example.com/고릅니다)
"""


def add_args(
    kind="검사", pattern="고릅니다", before="모델은 둘 중에서 고릅니다.", **extra
):
    argv = [
        "add",
        "--type",
        kind,
        "--before",
        before,
        "--after",
        extra.get("after", "모델은 둘 중에서 고를 수 있습니다."),
        "--reason",
        extra.get("reason", "사양처럼 단정했다"),
        "--post",
        extra.get("post", "demo"),
    ]
    if pattern:
        argv += ["--pattern", pattern]
    if "date" in extra:
        argv += ["--date", extra["date"]]
    return argv


class CorrectionsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.table = self.dir / "corrections.tsv"

    def tearDown(self):
        self.tmp.cleanup()

    def run_cli(self, *argv):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = cor.main(["--table", str(self.table), *argv])
        return code, out.getvalue()

    def rows(self):
        return cor.load(self.table)

    def test_add_writes_row_with_next_id_and_today(self):
        self.assertEqual(self.run_cli(*add_args("검토", pattern=""))[0], 0)
        code, out = self.run_cli(*add_args("결정", pattern="", before="사용기형 초안"))
        self.assertEqual(code, 0)
        self.assertIn("C002", out)
        self.assertIn("플레이북", out)
        row = self.rows()[1]
        self.assertEqual(row["first_seen"], date.today().isoformat())
        self.assertEqual(row["last_seen"], row["first_seen"])
        self.assertEqual(row["count"], "1")

    def test_add_rejects_check_row_that_does_not_hold(self):
        cases = [
            ("", "pattern이 필요"),
            ("선택합니다", "잡지 못합니다"),
            ("니다", "고친 문장에도"),
            ("(고릅니다)?", "빈 문자열"),
            ("(", "컴파일"),
        ]
        for pattern, message in cases:
            with self.subTest(pattern=pattern):
                code, out = self.run_cli(*add_args(pattern=pattern))
                self.assertEqual(code, 2)
                self.assertIn(message, out)
                self.assertFalse(self.table.exists())

    def test_add_rejects_pattern_on_non_check_row(self):
        code, out = self.run_cli(*add_args("검토"))
        self.assertEqual(code, 2)
        self.assertIn("검사 행에만", out)

    def test_add_steers_sentence_already_caught_to_hit(self):
        self.run_cli(*add_args())
        code, out = self.run_cli(
            *add_args("검토", pattern="", before="저는 이것을 고릅니다.")
        )
        self.assertEqual(code, 2)
        self.assertIn("hit C001", out)
        self.assertEqual(len(self.rows()), 1)

    def test_cells_drop_tabs_and_newlines_and_merge_same_after(self):
        before = "첫째로\t고릅니다. / 둘째로\n고릅니다."
        code, _ = self.run_cli(*add_args(before=before, after="(삭제) / (삭제)"))
        self.assertEqual(code, 0)
        lines = self.table.read_text(encoding="utf-8").splitlines()
        self.assertEqual([len(line.split("\t")) for line in lines], [10, 10])
        row = self.rows()[0]
        self.assertEqual(row["before"], "첫째로 고릅니다. / 둘째로 고릅니다.")
        self.assertEqual(row["after"], "(삭제)")

    def test_hit_counts_and_appends_caught_example(self):
        self.run_cli(*add_args())
        code, out = self.run_cli(
            "hit",
            "C001",
            "--before",
            "색은 셋 중에서 고릅니다.",
            "--after",
            "색은 셋 중에서 고를 수 있습니다.",
            "--post",
            "other",
        )
        self.assertEqual(code, 0)
        self.assertIn("훅", out)
        row = self.rows()[0]
        self.assertEqual(row["count"], "2")
        self.assertEqual(len(cor.pairs(row)), 2)
        self.assertEqual(row["post"], "demo, other")

    def test_hit_with_missed_example_requires_wider_pattern(self):
        self.run_cli(*add_args())
        example = [
            "--before",
            "자료를 옮기지 않습니다.",
            "--after",
            "자료를 옮기지 않아도 됩니다.",
        ]
        code, out = self.run_cli("hit", "C001", *example)
        self.assertEqual(code, 2)
        self.assertIn("--pattern으로 넓혀", out)
        self.assertEqual(self.rows()[0]["count"], "1")
        code, out = self.run_cli(
            "hit", "C001", "--pattern", "고릅니다|옮기지 않습니다", *example
        )
        self.assertEqual(code, 0)
        self.assertIn("패턴을 바꿨습니다", out)

    def test_hit_suggests_next_step_by_type(self):
        cases = [
            ("결정", "플레이북"),
            ("결정", "--reason으로 이유를 넓히세요"),
            ("이 글만", "이 글만이 아닙니다"),
        ]
        for kind, message in cases:
            with self.subTest(kind=kind):
                self.table.unlink(missing_ok=True)
                self.run_cli(*add_args(kind, pattern=""))
                code, out = self.run_cli("hit", "C001")
                self.assertEqual(code, 0)
                self.assertIn(message, out)

    def test_review_hit_needs_check_or_wider_reason(self):
        self.run_cli(*add_args("검토", pattern=""))
        code, out = self.run_cli("hit", "C001")
        self.assertEqual(code, 2)
        self.assertIn("--type 검사", out)
        self.assertIn("--reason으로 이유를 이번 경우까지", out)
        self.assertEqual(self.rows()[0]["count"], "1")
        code, out = self.run_cli("hit", "C001", "--reason", "넓힌 이유")
        self.assertEqual(code, 0)
        self.assertIn("이유를 넓혔습니다", out)
        row = self.rows()[0]
        self.assertEqual((row["reason"], row["count"]), ("넓힌 이유", "2"))
        self.run_cli(*add_args("이 글만", pattern="", before="다른 문장"))
        self.assertEqual(self.run_cli("hit", "C002", "--type", "검토")[0], 2)

    def test_scan_shows_where_new_pattern_matches(self):
        posts = self.dir / "posts"
        posts.mkdir()
        (posts / "a.md").write_text(POST, encoding="utf-8")
        (posts / "b.md").write_text("---\ntitle: 예시\n---\n\n고를 수 있습니다.\n", encoding="utf-8")
        code, out = self.run_cli(*add_args(), "--scan", str(posts))
        self.assertEqual(code, 0)
        self.assertIn("글 2편에서 이 패턴에 걸린 곳 2", out)
        self.assertIn("a.md:2", out)
        self.assertIn("edit C001 --pattern으로 좁히고", out)
        code, out = self.run_cli(
            "edit", "C001", "--pattern", "중에서 고릅니다", "--scan", str(posts)
        )
        self.assertEqual(code, 0)
        self.assertIn("걸린 곳 1", out)
        _, out = self.run_cli("edit", "C001", "--reason", "x", "--scan", str(posts))
        self.assertNotIn("걸린 곳", out)
        code, out = self.run_cli(*add_args(), "--scan", str(self.dir / "없음"))
        self.assertEqual(code, 2)
        self.assertIn("--scan 폴더가 없습니다", out)
        self.assertEqual(len(self.rows()), 1)

    def test_hit_can_escalate_review_to_check(self):
        self.run_cli(*add_args("검토", pattern=""))
        code, out = self.run_cli(
            "hit", "C001", "--type", "검사", "--pattern", "고릅니다"
        )
        self.assertEqual(code, 0)
        self.assertIn("검토 -> 검사", out)
        row = self.rows()[0]
        self.assertEqual(
            (row["type"], row["pattern"], row["count"]), ("검사", "고릅니다", "2")
        )

    def test_edit_keeps_count_and_clears_pattern_off_check(self):
        self.run_cli(*add_args())
        self.run_cli("hit", "C001")
        code, _ = self.run_cli("edit", "c001", "--type", "검토")
        self.assertEqual(code, 0)
        row = self.rows()[0]
        self.assertEqual((row["type"], row["pattern"], row["count"]), ("검토", "", "2"))
        code, out = self.run_cli("edit", "C099", "--reason", "x")
        self.assertEqual(code, 2)
        self.assertIn("list로 id", out)

    def test_check_reads_prose_only(self):
        self.run_cli(*add_args())
        post = self.dir / "post.md"
        post.write_text(POST, encoding="utf-8")
        code, out = self.run_cli("check", str(post))
        self.assertEqual(code, 1)
        hit_lines = [line for line in out.splitlines() if " C001 " in line]
        self.assertEqual(
            [line.split(" ")[0].rsplit(":", 1)[1] for line in hit_lines], ["2", "6"]
        )
        self.assertIn("고친 예: 모델은 둘 중에서 고를 수 있습니다.", out)
        self.assertIn("지난 교정 검사 1개, 걸린 곳 2", out)

    def test_check_passes_clean_post_and_empty_table(self):
        post = self.dir / "post.md"
        post.write_text(
            "---\ntitle: 예시\n---\n\n고를 수 있습니다.\n", encoding="utf-8"
        )
        self.assertEqual(
            self.run_cli("check", str(post)), (0, "지난 교정 검사 0개, 걸린 곳 0\n")
        )
        self.run_cli(*add_args())
        self.assertEqual(self.run_cli("check", str(post))[0], 0)

    def test_check_shows_fix_of_example_that_matched(self):
        self.run_cli(
            *add_args(
                pattern="고릅니다|옮기지 않습니다",
                before="모델은 둘 중에서 고릅니다. / 자료를 옮기지 않습니다.",
                after="모델은 둘 중에서 고를 수 있습니다. / 자료를 옮기지 않아도 됩니다.",
            )
        )
        post = self.dir / "post.md"
        post.write_text("파일을 옮기지 않습니다.\n", encoding="utf-8")
        _, out = self.run_cli("check", str(post))
        self.assertIn("고친 예: 자료를 옮기지 않아도 됩니다.", out)

    def test_brief_orders_by_count_then_recency_without_one_off(self):
        self.run_cli(*add_args("검토", pattern="", before="첫째", date="2026-09-01"))
        self.run_cli(*add_args("검토", pattern="", before="둘째", date="2026-09-10"))
        self.run_cli(*add_args("이 글만", pattern="", before="셋째", date="2026-09-20"))
        self.run_cli(*add_args("검토", pattern="", before="넷째", date="2026-09-10"))
        self.run_cli("hit", "C001", "--date", "2026-09-05", "--reason", "넓힌 이유")
        _, out = self.run_cli("brief")
        order = [
            line.split(" ")[0] for line in out.splitlines() if line.startswith("C")
        ]
        self.assertEqual(order, ["C001", "C002", "C004"])
        _, out = self.run_cli("brief", "--top", "1")
        self.assertEqual(
            [line[:4] for line in out.splitlines() if line.startswith("C")], ["C001"]
        )

    def test_brief_type_shows_every_row_of_that_type(self):
        for i in range(cor.BRIEF_TOP + 2):
            self.run_cli(*add_args("결정", pattern="", before=f"결정 {i}"))
        self.run_cli(*add_args("검토", pattern="", before="검토 하나"))
        _, out = self.run_cli("brief", "--type", "결정")
        ids = [line[:4] for line in out.splitlines() if line.startswith("C")]
        self.assertEqual(len(ids), cor.BRIEF_TOP + 2)
        self.assertNotIn(f"C{cor.BRIEF_TOP + 3:03d}", ids)
        self.assertIn("플레이북에서 같은 id로", out)
        _, out = self.run_cli("brief", "--type", "결정", "--top", "2")
        self.assertEqual(
            len([line for line in out.splitlines() if line.startswith("C")]), 2
        )
        _, out = self.run_cli("brief")
        self.assertEqual(
            len([line for line in out.splitlines() if line.startswith("C")]),
            cor.BRIEF_TOP,
        )

    def test_review_is_checklist_of_decisions_and_reviews(self):
        self.run_cli(*add_args("결정", pattern="", before="첫째"))
        self.run_cli(*add_args("검토", pattern="", before="둘째"))
        self.run_cli(*add_args())
        self.run_cli(*add_args("이 글만", pattern="", before="넷째"))
        _, out = self.run_cli("review")
        self.assertIn("- [ ] C001", out)
        self.assertIn("- [ ] C002", out)
        self.assertIn("- C003:", out)
        self.assertNotIn("C004", out)
        self.assertLess(out.index("C001"), out.index("C002"))

    def test_broken_table_is_reported_with_line(self):
        header = "\t".join(cor.COLUMNS)
        self.table.write_text(header + "\nC001\t검토\n", encoding="utf-8")
        code, out = self.run_cli("list")
        self.assertEqual(code, 2)
        self.assertIn(":2 칸이 2개", out)

    def test_shipped_table_is_valid(self):
        rows = cor.load(cor.TABLE)
        self.assertTrue(rows)
        for row in rows:
            if row["type"] == "결정":
                with self.subTest(row=row["id"]):
                    self.assertIn("플레이북", row["reason"])

if __name__ == "__main__":
    unittest.main()
