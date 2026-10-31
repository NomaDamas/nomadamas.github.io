#!/usr/bin/env python3
"""recheck_values: 표 읽기, 값 비교, 종료 코드, 조회 결과 해석. 네트워크 없이 돈다."""

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import recheck_values as rv

TABLE = (
    "# kind\ttarget\tvalue\tnote\n"
    "\n"
    "gh-org\tNomaDamas\t90/12,139\t소개 문단\n"
    "hn\t49717558\t1,989\t도입의 해커뉴스 점수\n"
)


def fetchers(**values):
    """kind마다 정해 둔 값을 돌려주는 조회 함수. 값이 예외면 그 예외를 낸다."""

    def make(kind):
        def fetch(target):
            value = values[kind.replace("-", "_")]
            if isinstance(value, Exception):
                raise value
            return value

        return fetch

    return {kind: make(kind) for kind in rv.FETCHERS}


class ParseTests(unittest.TestCase):
    def test_skips_comments_and_blank_lines(self):
        rows = rv.parse(TABLE)
        self.assertEqual([r["line"] for r in rows], [3, 4])
        self.assertEqual(rows[0]["kind"], "gh-org")
        self.assertEqual(rows[1]["note"], "도입의 해커뉴스 점수")

    def test_search_target_keeps_spaces(self):
        rows = rv.parse("gh-search\tcreated:2026-01-01..2026-12-31 stars:>7907\t382\t순위\n")
        self.assertEqual(rows[0]["target"], "created:2026-01-01..2026-12-31 stars:>7907")

    def test_reports_line_of_bad_row(self):
        cases = [
            ("gh-org\tNomaDamas\n", "1행: kind, target, value"),
            ("hn\t1\t2\n\ngh-star\tNomaDamas/k-skill\t1\n", "3행: kind 'gh-star'"),
            ("# 주석만\n", "조회할 줄이 없습니다"),
        ]
        for text, message in cases:
            with self.subTest(text=text):
                with self.assertRaises(rv.RecheckError) as ctx:
                    rv.parse(text)
                self.assertIn(message, str(ctx.exception))


class RecheckTests(unittest.TestCase):
    def test_commas_and_spaces_do_not_count_as_change(self):
        results = rv.recheck(rv.parse(TABLE), fetchers(gh_org="90/12139", hn="1989"))
        self.assertEqual([s for s, _ in results], ["같음", "같음"])

    def test_change_and_failure_are_kept_per_row(self):
        results = rv.recheck(
            rv.parse(TABLE),
            fetchers(gh_org="91/12200", hn=rv.RecheckError("해커뉴스 API 조회 실패")),
        )
        self.assertEqual(results, [("다름", "91/12200"), ("실패", "해커뉴스 API 조회 실패")])


class MainTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.table = Path(self.tmp.name) / "recheck.tsv"
        self.table.write_text(TABLE, encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def run_main(self, argv, **values):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = rv.main(argv, fetchers(**values))
        return code, out.getvalue()

    def test_exit_code_tells_same_changed_failed(self):
        code, out = self.run_main([str(self.table)], gh_org="90/12139", hn="1989")
        self.assertEqual(code, 0)
        self.assertIn("같음 2, 다름 0, 실패 0", out)

        code, out = self.run_main([str(self.table)], gh_org="90/12139", hn="2004")
        self.assertEqual(code, 1)
        self.assertIn("| 다름 | hn | 49717558 | 1,989 | 2004 | 도입의 해커뉴스 점수 |", out)
        self.assertIn("recheck.tsv의 value도", out)

        code, out = self.run_main(
            [str(self.table)], gh_org="91/12139", hn=rv.RecheckError("gh: Not Found (HTTP 404)")
        )
        self.assertEqual(code, 2)
        self.assertIn("| 실패 | hn |", out)
        self.assertIn("recheck.tsv의 value도", out)

    def test_missing_or_broken_table_is_input_error(self):
        code, out = self.run_main([str(self.table.with_name("없음.tsv"))])
        self.assertEqual(code, 2)
        self.assertIn("파일이 없습니다", out)
        self.table.write_text("gh-org NomaDamas 90/12139\n", encoding="utf-8")
        code, out = self.run_main([str(self.table)])
        self.assertEqual(code, 2)
        self.assertIn("탭으로", out)


class FetcherTests(unittest.TestCase):
    def test_gh_org_counts_public_repos_and_sums_stars(self):
        with mock.patch.object(rv, "gh", return_value="3\n0\n10\n") as gh:
            self.assertEqual(rv.gh_org("NomaDamas"), "3/13")
        args = gh.call_args.args
        self.assertIn("--paginate", args)
        self.assertIn("orgs/NomaDamas/repos?type=public&per_page=100", args)

    def test_gh_pr_reads_repo_and_number(self):
        with mock.patch.object(rv, "gh", return_value="merged") as gh:
            self.assertEqual(rv.gh_pr("Marker-Inc-Korea/AutoRAG#1771"), "merged")
        self.assertEqual(gh.call_args.args[0], "repos/Marker-Inc-Korea/AutoRAG/pulls/1771")
        with mock.patch.object(rv, "gh") as gh:
            with self.assertRaises(rv.RecheckError) as ctx:
                rv.gh_pr("Marker-Inc-Korea/AutoRAG 1771")
            gh.assert_not_called()
        self.assertIn("#<번호>", str(ctx.exception))

    def test_gh_search_reads_total_count(self):
        with mock.patch.object(rv, "gh", return_value="382\tfalse") as gh:
            self.assertEqual(rv.gh_search("created:2026-01-01..2026-12-31 stars:>7907"), "382")
        args = gh.call_args.args
        self.assertIn("search/repositories", args)
        self.assertIn("q=created:2026-01-01..2026-12-31 stars:>7907", args)

    def test_gh_search_incomplete_results_is_error(self):
        with mock.patch.object(rv, "gh", return_value="381\ttrue"):
            with self.assertRaises(rv.RecheckError) as ctx:
                rv.gh_search("stars:>1")
        self.assertIn("어림값", str(ctx.exception))

    def test_hn_reads_score_and_comments(self):
        item = json.dumps({"id": 49717558, "score": 1989, "descendants": 520}).encode()
        with mock.patch.object(rv.urllib.request, "urlopen", side_effect=lambda *a, **k: io.BytesIO(item)):
            self.assertEqual(rv.hn("49717558"), "1989")
            self.assertEqual(rv.hn_comments("49717558"), "520")

    def test_hn_rejects_non_number_before_request(self):
        with mock.patch.object(rv.urllib.request, "urlopen") as urlopen:
            with self.assertRaises(rv.RecheckError) as ctx:
                rv.hn("item?id=49717558")
            urlopen.assert_not_called()
        self.assertIn("숫자", str(ctx.exception))

    def test_hn_missing_item_is_error(self):
        with mock.patch.object(rv.urllib.request, "urlopen", side_effect=lambda *a, **k: io.BytesIO(b"null")):
            with self.assertRaises(rv.RecheckError) as ctx:
                rv.hn("1")
        self.assertIn("글 번호를 확인", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
