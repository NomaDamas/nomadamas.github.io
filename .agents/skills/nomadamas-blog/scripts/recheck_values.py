#!/usr/bin/env python3
"""글 속 변하는 값(star, 저장소 수, 검색 결과 수, 해커뉴스 점수, 최신 릴리스, PR 상태)을 다시 조회해 원고 값과 맞는지 본다.

값 목록은 작업 폴더의 recheck.tsv에 둔다. 탭으로 나눈 네 칸이고 #로 시작하는 줄은 주석이다.
  kind    무엇을 조회하나
  target  조회 대상
  value   원고에 쓴 값. 쉼표와 공백은 빼고 비교한다
  note    원고의 어느 문장인지

kind:
  gh-stars     <owner>/<repo>      저장소 star 수
  gh-org       <org>               공개 저장소 수/star 합(예: 90/12139). fork도 센다
  gh-release   <owner>/<repo>      최신 정식 릴리스 태그(예: v2.8.0). 미리보기 릴리스는 빼고 본다
  gh-pr        <owner>/<repo>#<번호>  PR 상태: open, merged, closed
  gh-search    <검색어>            GitHub 저장소 검색 결과 수. 포크는 기본으로 빠진다
  hn           <글 번호>           해커뉴스 글 점수
  hn-comments  <글 번호>           해커뉴스 글 댓글 수

예(recheck.tsv):
  gh-org	NomaDamas	90/12139	NomaDamas 소개 문단
  gh-release	Marker-Inc-Korea/AutoRAG	v2.8.0	AutoRAG 절 마지막 문장
  gh-pr	Marker-Inc-Korea/AutoRAG#1771	merged	"다음 릴리스부터 들어간다"
  gh-search	created:2026-01-01..2026-12-31 stars:>7907	382	올해 만든 저장소 중 383번째(더 많은 저장소 수에 1을 더함)
  hn	49717558	1989	도입의 해커뉴스 점수

사용:
  recheck_values.py <recheck.tsv>

값이 바뀌었으면 원고, 그림, 근거 표를 함께 고치고 recheck.tsv의 value도 고친다.
읽기만 한다(gh api GET, 해커뉴스 공개 API).

종료 코드: 0 모두 같음, 1 원고와 다른 값이 있음, 2 입력 오류나 조회 실패
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

# gh-org는 저장소 목록을 쪽마다 받아 수백 개면 수십 초가 걸린다. 그보다 길면 네트워크 문제로 본다
GH_TIMEOUT = 120
HN_TIMEOUT = 20
HN_ITEM = "https://hacker-news.firebaseio.com/v0/item/{}.json"
PR_TARGET = re.compile(r"([\w.-]+/[\w.-]+)#(\d+)")


class RecheckError(Exception):
    """입력이나 조회가 잘못됐다. 메시지에 고치는 방법을 담는다."""


def gh(*args):
    try:
        done = subprocess.run(
            ["gh", "api", *args],
            capture_output=True,
            text=True,
            timeout=GH_TIMEOUT,
        )
    except FileNotFoundError:
        raise RecheckError("gh가 없습니다. GitHub CLI를 설치하고 gh auth login을 하세요")
    except subprocess.TimeoutExpired:
        raise RecheckError(f"gh api가 {GH_TIMEOUT}초 안에 끝나지 않았습니다")
    if done.returncode != 0:
        err = done.stderr.strip()
        raise RecheckError(err.splitlines()[-1] if err else "gh api 실패")
    return done.stdout.strip()


def gh_stars(target):
    return gh(f"repos/{target}", "--jq", ".stargazers_count")


def gh_org(target):
    out = gh(
        "--paginate",
        f"orgs/{target}/repos?type=public&per_page=100",
        "--jq",
        ".[] | .stargazers_count",
    )
    stars = [int(line) for line in out.splitlines() if line.strip()]
    return f"{len(stars)}/{sum(stars)}"


def gh_release(target):
    return gh(f"repos/{target}/releases/latest", "--jq", ".tag_name")


def gh_pr(target):
    m = PR_TARGET.fullmatch(target)
    if not m:
        raise RecheckError(f"gh-pr target은 <owner>/<repo>#<번호> 모양입니다: {target!r}")
    repo, number = m.groups()
    return gh(f"repos/{repo}/pulls/{number}", "--jq", 'if .merged_at then "merged" else .state end')


def gh_search(target):
    out = gh(
        "-X",
        "GET",
        "search/repositories",
        "-f",
        f"q={target}",
        "-f",
        "per_page=1",
        "--jq",
        "[.total_count, .incomplete_results] | @tsv",
    )
    count, _, incomplete = out.partition("\t")
    if incomplete.strip() == "true":
        raise RecheckError(
            "검색이 제한 시간 안에 끝나지 않아 결과 수가 어림값입니다(incomplete_results). "
            "기간을 나눠 센 뒤 더하세요"
        )
    return count.strip()


def hn_item(target):
    try:
        item_id = int(target)
    except ValueError:
        raise RecheckError(f"해커뉴스 target은 글 번호(숫자)입니다: {target!r}")
    try:
        with urllib.request.urlopen(HN_ITEM.format(item_id), timeout=HN_TIMEOUT) as r:
            item = json.load(r)
    except (OSError, ValueError) as e:
        raise RecheckError(f"해커뉴스 API 조회 실패: {e}")
    if not item:
        raise RecheckError(f"해커뉴스 글 {item_id}이 없습니다. 글 번호를 확인하세요")
    return item


def hn(target):
    return str(hn_item(target).get("score"))


def hn_comments(target):
    return str(hn_item(target).get("descendants"))


FETCHERS = {
    "gh-stars": gh_stars,
    "gh-org": gh_org,
    "gh-release": gh_release,
    "gh-pr": gh_pr,
    "gh-search": gh_search,
    "hn": hn,
    "hn-comments": hn_comments,
}


def normalize(value):
    return "".join(value.replace(",", "").split())


def parse(text):
    rows = []
    for lineno, line in enumerate(text.splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        cells = [c.strip() for c in line.split("\t")]
        if len(cells) < 3 or not all(cells[:3]):
            raise RecheckError(
                f"{lineno}행: kind, target, value가 탭으로 나뉘어 있어야 합니다. note는 넷째 칸입니다"
            )
        if cells[0] not in FETCHERS:
            raise RecheckError(
                f"{lineno}행: kind {cells[0]!r}를 모릅니다. 쓸 수 있는 값: {', '.join(FETCHERS)}"
            )
        note = cells[3] if len(cells) > 3 else ""
        rows.append({"line": lineno, "kind": cells[0], "target": cells[1], "value": cells[2], "note": note})
    if not rows:
        raise RecheckError("조회할 줄이 없습니다. kind, target, value, note를 탭으로 나눠 적으세요")
    return rows


def recheck(rows, fetchers=FETCHERS):
    """줄마다 (상태, 지금 값) 목록. 상태는 같음, 다름, 실패다."""
    results = []
    for row in rows:
        try:
            now = fetchers[row["kind"]](row["target"])
        except RecheckError as e:
            results.append(("실패", str(e)))
            continue
        same = normalize(now) == normalize(row["value"])
        results.append(("같음" if same else "다름", now))
    return results


def main(argv=None, fetchers=FETCHERS):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("table", type=Path, help="kind, target, value, note를 탭으로 나눈 파일")
    args = parser.parse_args(argv)
    if not args.table.is_file():
        print(f"오류: 파일이 없습니다: {args.table}", file=sys.stderr)
        return 2
    try:
        rows = parse(args.table.read_text(encoding="utf-8"))
    except RecheckError as e:
        print(f"오류: {e}", file=sys.stderr)
        return 2
    results = recheck(rows, fetchers)
    print("| 상태 | kind | target | 원고 | 지금 | 문장 |")
    print("|---|---|---|---|---|---|")
    for row, (status, now) in zip(rows, results):
        print(f"| {status} | {row['kind']} | {row['target']} | {row['value']} | {now} | {row['note']} |")
    counts = {s: sum(1 for st, _ in results if st == s) for s in ("같음", "다름", "실패")}
    print(f"같음 {counts['같음']}, 다름 {counts['다름']}, 실패 {counts['실패']}")
    if counts["다름"]:
        print("다른 값은 원고, 그림, 근거 표를 함께 고치고 recheck.tsv의 value도 고치세요")
    if counts["실패"]:
        print("실패한 줄은 target과 gh auth status를 확인하고 다시 돌리세요")
        return 2
    return 1 if counts["다름"] else 0


if __name__ == "__main__":
    sys.exit(main())
