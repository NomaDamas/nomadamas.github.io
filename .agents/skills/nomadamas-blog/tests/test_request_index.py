#!/usr/bin/env python3
"""request_index: 속성 밖 주소와 다른 계정에서는 누르지 않고, 결과 창을 잘못 읽지 않는다."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import request_index as ri


class PropertyTest(unittest.TestCase):
    def test_domain_property_covers_subdomains_only(self):
        prop = "sc-domain:example.org"
        self.assertTrue(ri.in_property(prop, "https://example.org/"))
        self.assertTrue(ri.in_property(prop, "https://blog.example.org/posts/a/"))
        self.assertFalse(ri.in_property(prop, "https://example.org.evil.com/"))
        self.assertFalse(ri.in_property(prop, "https://notexample.org/"))
        self.assertFalse(ri.in_property(prop, "https://evil.com/?u=example.org"))
        self.assertFalse(ri.in_property(prop, "blog.example.org/posts/a/"))

    def test_url_prefix_property(self):
        prop = "https://blog.example.org/"
        self.assertTrue(ri.in_property(prop, "https://blog.example.org/posts/a/"))
        self.assertFalse(ri.in_property(prop, "https://example.org/"))

    def test_unknown_property_format_is_rejected(self):
        with self.assertRaises(ValueError):
            ri.in_property("example.org", "https://example.org/")

    def test_outside_url_stops_before_running(self):
        code = ri.main(["--account", "u0", "--property", "sc-domain:example.org",
                        "--google-account", "a@example.org", "https://other.org/"])
        self.assertEqual(code, 2)


class ScriptTest(unittest.TestCase):
    def test_values_are_json_strings(self):
        js = ri.build_js('https://example.org/a"b/', "sc-domain:example.org", "a@example.org")
        self.assertIn('const target = "https://example.org/a\\"b/";', js)
        self.assertIn('const account = "a@example.org";', js)
        self.assertIn('"sc-domain%3Aexample.org"', js)
        self.assertNotIn("__URL__", js)
        self.assertNotIn("__ACCOUNT__", js)
        self.assertNotIn("__RESOURCE__", js)

    def test_no_submit_never_clicks(self):
        js = ri.build_js("https://example.org/", "sc-domain:example.org", "a@example.org", submit=False)
        self.assertIn("const submit = false;", js)
        self.assertIn("if (submit) await t.locator(btn).click();", js)
        self.assertEqual(js.count(".click()"), 1)

    def test_account_is_checked_before_typing(self):
        js = ri.build_js("https://example.org/", "sc-domain:example.org", "a@example.org")
        self.assertLess(js.index("Google 계정:"), js.index(".fill(target)"))


class OutputTest(unittest.TestCase):
    def test_requested(self):
        out = 'STATE: ["URL이 Google에 등록되어 있지 않음"]\nRESULT: requested\n[ok | 40000ms]'
        self.assertEqual(ri.parse_output(out), ("requested", '["URL이 Google에 등록되어 있지 않음"]'))

    def test_inspected(self):
        self.assertEqual(ri.parse_output("STATE: []\nRESULT: inspected")[0], "inspected")

    def test_quota_and_missing_dialog(self):
        self.assertEqual(ri.parse_output("STATE: []\nRESULT: quota")[0], "quota")
        self.assertEqual(ri.parse_output("STATE: []\nRESULT: no-dialog")[0], "no-dialog")

    def test_script_failure_wins_over_other_lines(self):
        out = "FAILED: 화면의 Google 계정이 a@example.org가 아니다\n[ok | 9000ms]"
        self.assertEqual(ri.parse_output(out), ("failed", "화면의 Google 계정이 a@example.org가 아니다"))

    def test_output_without_result_line_is_failure(self):
        result, note = ri.parse_output("TypeError: boom\n[error | 7ms]")
        self.assertEqual(result, "failed")
        self.assertIn("결과 줄이 없다", note)

    def test_result_word_inside_other_text_is_not_a_result(self):
        self.assertEqual(ri.parse_output("log: RESULT: requested later")[0], "failed")


if __name__ == "__main__":
    unittest.main()
