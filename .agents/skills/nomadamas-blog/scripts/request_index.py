#!/usr/bin/env python3
"""Search Console 소유자 화면에서 주소마다 색인 생성을 요청한다.

사용:
  request_index.py --account <Aside 계정> --property <속성> --google-account <이메일> <주소>...
                   [--no-submit] [--dry-run]

  --account         Search Console 소유자로 로그인된 Aside 계정(예: u0)
  --property        Search Console 속성. sc-domain:<도메인> 또는 https://<호스트>/ 형식
  --google-account  화면에 보여야 하는 Google 계정 이메일. 다르면 아무것도 누르지 않고 멈춘다
  --no-submit       버튼을 찾고 요청 전 상태만 읽은 뒤 누르지 않는다. 제출 없이 화면을 시험할 때 쓴다
  --dry-run         첫 주소로 만든 Aside 스크립트를 출력만 하고 실행하지 않는다

주소마다 Aside 탭을 열어 상단 URL 검사 입력칸에 넣고 "색인 생성 요청"을 누른 뒤
결과 창을 기다린다. 실제 URL 테스트를 거쳐 건당 30초 안팎 걸린다.

결과 (주소마다 한 줄):
  requested  요청됨
  inspected  --no-submit으로 요청 전 상태만 읽었다
  quota      할당량 초과. 남은 주소는 보내지 않는다
  error      화면이 오류 창을 띄웠다
  no-dialog  결과 창이 뜨지 않았다
  failed     계정 불일치, 입력칸이나 버튼 없음, 시간 초과 같은 스크립트 실패
기대한 결과(requested, --no-submit이면 inspected)가 아닌 주소가 하나라도 있으면 종료 코드 1이다. 주소가 속성 밖이면 시작 전에 멈춘다.

색인 생성 요청은 사이트 제출이다. 실행 전에 주소 목록으로 승인받는다.
"""

import argparse
import json
import re
import subprocess
import sys
from urllib.parse import quote, urlparse

# 결과 창을 기다리는 시간을 포함해 주소 하나가 이보다 오래 걸리면 화면이 멈춘 것으로 본다
TIMEOUT_S = 240

RESULT_RE = re.compile(r"^RESULT: (requested|inspected|quota|error|no-dialog)$", re.M)
STATE_RE = re.compile(r"^STATE: (.*)$", re.M)
ERROR_RE = re.compile(r"^FAILED: (.*)$", re.M)

JS_TEMPLATE = r"""
const target = __URL__;
const account = __ACCOUNT__;
const submit = __SUBMIT__;
const t = await openTab("https://search.google.com/search-console?resource_id=" + __RESOURCE__);
try {
  // 로딩 중 snapshot에는 계정 버튼이 빠질 수 있어 몇 번 다시 본다
  let s0 = null;
  let accountShown = false;
  for (let i = 0; i < 4 && !accountShown; i++) {
    await sleep(2500);
    s0 = await snapshot(t, { interactive: true });
    accountShown = s0.tree.split("\n").some((l) => l.includes("Google 계정:") && l.includes(account));
  }
  if (!accountShown) throw new Error("화면의 Google 계정이 " + account + "가 아니다");
  const box = s0.tree.match(/combobox "[^"]*모든 URL 검사" \[ref=(\w+)\]/);
  if (!box) throw new Error("URL 검사 입력칸을 찾지 못했다");
  await t.locator(box[1]).fill(target);
  await t.keyboard.press("Enter");
  // 버튼 이름은 상태에 따라 "색인 생성 요청" 뒤에 글자가 붙는다
  let btn = null;
  let s1 = null;
  for (let i = 0; i < 12 && !btn; i++) {
    await sleep(2500);
    s1 = await snapshot(t);
    const m = s1.tree.match(/button "색인 생성 요청[^"]*" \[ref=(\w+)\](?! \[disabled\])/);
    if (s1.tree.includes('text: "' + target + '"') && m) btn = m[1];
  }
  if (!btn) throw new Error("색인 생성 요청 버튼을 찾지 못했다");
  const state = s1.tree.match(/페이지 색인이 생성되지 않음: [^"\]]*|URL이 Google에 등록되어 있음|URL이 Google에 등록되어 있지 않음/g);
  console.log("STATE: " + JSON.stringify(state || []));
  let result = submit ? "no-dialog" : "inspected";
  if (submit) await t.locator(btn).click();
  for (let i = 0; i < 30 && result === "no-dialog"; i++) {
    await sleep(2500);
    const s2 = await snapshot(t);
    if (/dialog "색인 생성 요청됨"/.test(s2.tree)) result = "requested";
    else if (/할당량/.test(s2.tree)) result = "quota";
    else if (/dialog "[^"]*(문제|오류)[^"]*"/.test(s2.tree)) result = "error";
  }
  console.log("RESULT: " + result);
} catch (e) {
  console.log("FAILED: " + e.message);
} finally {
  await closeTab(t);
}
"""


def in_property(prop: str, url: str) -> bool:
    """주소가 Search Console 속성 범위 안인지 본다."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    if prop.startswith("sc-domain:"):
        domain = prop.removeprefix("sc-domain:").lower()
        host = parsed.hostname.lower()
        return bool(domain) and (host == domain or host.endswith("." + domain))
    if prop.startswith(("https://", "http://")) and prop.endswith("/"):
        return url.startswith(prop)
    raise ValueError(f"속성 형식이 아니다: {prop} (sc-domain:<도메인> 또는 https://<호스트>/)")


def build_js(url: str, prop: str, google_account: str, submit: bool = True) -> str:
    """주소 하나를 요청하는 Aside repl 스크립트를 만든다. 값은 JSON으로 넣는다."""
    return (
        JS_TEMPLATE.replace("__URL__", json.dumps(url))
        .replace("__ACCOUNT__", json.dumps(google_account))
        .replace("__SUBMIT__", json.dumps(submit))
        .replace("__RESOURCE__", json.dumps(quote(prop, safe="")))
    )


def parse_output(output: str) -> tuple[str, str]:
    """Aside 출력에서 결과와 메모(요청 전 상태나 실패 이유)를 꺼낸다."""
    failed = ERROR_RE.search(output)
    if failed:
        return "failed", failed.group(1).strip()
    result = RESULT_RE.search(output)
    if not result:
        tail = " / ".join(line.strip() for line in output.strip().splitlines()[-3:])
        return "failed", f"결과 줄이 없다: {tail}"
    state = STATE_RE.search(output)
    return result.group(1), state.group(1).strip() if state else ""


def run_one(account: str, js: str) -> tuple[str, str]:
    try:
        proc = subprocess.run(
            ["aside", "repl", "--account", account, js],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        return "failed", f"{TIMEOUT_S}초 안에 끝나지 않았다"
    return parse_output(proc.stdout + proc.stderr)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__.split("\n\n")[0],
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="\n\n".join(__doc__.split("\n\n")[1:]),
    )
    ap.add_argument("--account", required=True)
    ap.add_argument("--property", required=True, dest="prop")
    ap.add_argument("--google-account", required=True)
    ap.add_argument("--no-submit", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("urls", nargs="+")
    args = ap.parse_args(argv)

    try:
        outside = [u for u in args.urls if not in_property(args.prop, u)]
    except ValueError as e:
        print(e, file=sys.stderr)
        return 2
    if outside:
        print("속성 밖 주소라 시작하지 않는다: " + ", ".join(outside), file=sys.stderr)
        return 2

    if args.dry_run:
        print(build_js(args.urls[0], args.prop, args.google_account, not args.no_submit))
        return 0

    expected = "inspected" if args.no_submit else "requested"
    ok = True
    for i, url in enumerate(args.urls):
        js = build_js(url, args.prop, args.google_account, not args.no_submit)
        result, note = run_one(args.account, js)
        print(f"{result}\t{url}\t{note}", flush=True)
        if result != expected:
            ok = False
        if result in ("quota", "failed"):
            rest = args.urls[i + 1 :]
            if rest:
                print(f"멈춤: 남은 주소 {len(rest)}개는 보내지 않았다", file=sys.stderr)
            break
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
