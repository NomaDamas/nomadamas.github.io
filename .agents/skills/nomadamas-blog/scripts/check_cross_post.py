#!/usr/bin/env python3
"""원고에서 다른 발행 글과 거의 같은 문장을 찾는다.

글마다 같은 소개 문장이나 비유를 되풀이하면 사람이 쓴 글보다 틀에서 찍어 낸 글로 읽힌다.
문장 단위 윤문 도구는 한 글만 보므로 이 반복을 잡지 못한다.

사용:
  check_cross_post.py <post.md>                         같은 폴더의 다른 글과 비교
  check_cross_post.py <post.md> --posts-dir <폴더>      다른 폴더의 글과 비교
  check_cross_post.py <post.md> --threshold 0.8         더 비슷한 것만

비교 범위:
  - 본문 산문과 frontmatter의 title, description. 코드, 주소, 이미지 줄, 영상 태그, 제목 줄, 표는 보지 않는다
  - 한글이 --min-chars자보다 적은 문장(GitHub 주소 줄 같은 것)은 보지 않는다
  - 다른 글의 절반 이상에 나오는 문장(AI 보조 고지 같은 공통 문구)은 따로 세기만 한다
  - 숫자만 다른 같은 틀의 문장(star 수 소개)은 유사도 0.7~0.8에 걸린다. 기본 0.8은 이런 문장을 빼고
    거의 그대로 옮긴 문장만 잡는다

종료 코드: 0 겹치는 문장 없음, 1 있음, 2 입력 오류
"""

import argparse
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from check_post_invariants import (
    HEADING_RE,
    LIST_ITEM_RE,
    QUOTE_RE,
    TABLE_ROW_RE,
    VISUAL_RE,
    facts,
    prose_lines,
)

SENTENCE_END_RE = re.compile(r"(?<=[.!?])\s+")
NOT_TEXT_RE = re.compile(r"[^0-9A-Za-z가-힣]")
HANGUL_RE = re.compile(r"[가-힣]")
# prose_lines는 링크 주소를 공백으로 비워 두므로 대괄호와 남은 공백만 걷는다
MARKUP_RE = re.compile(r"[\[\]*_]+")
SPACES_RE = re.compile(r"\s+")


def sentences(path):
    """(행 번호, 원문 문장, 비교용 글자) 목록."""
    f = facts(path.read_text(encoding="utf-8"))
    out = []
    for n, line in prose_lines(f):
        # 이미지 줄은 주소가 비워져 `![대체 텍스트]`만 남는다
        if (
            line.lstrip().startswith("![")
            or VISUAL_RE.search(line)
            or HEADING_RE.match(line)
            or TABLE_ROW_RE.match(line)
        ):
            continue
        line = LIST_ITEM_RE.sub("", QUOTE_RE.sub("", line))
        line = SPACES_RE.sub(" ", MARKUP_RE.sub("", line)).strip()
        for s in SENTENCE_END_RE.split(line):
            s = s.strip()
            if s:
                out.append((n, s, NOT_TEXT_RE.sub("", s)))
    return out


def long_enough(row, min_chars):
    return len(HANGUL_RE.findall(row[1])) >= min_chars


def similar(a, b, threshold):
    m = SequenceMatcher(None, a, b, autojunk=False)
    if m.real_quick_ratio() < threshold or m.quick_ratio() < threshold:
        return 0.0
    return m.ratio()


def find_overlaps(post, others, threshold, min_chars):
    """(겹침 목록, 공통 문구 수). 겹침은 (행, 문장, 다른 글, 다른 행, 다른 문장, 유사도)."""
    mine = [s for s in sentences(post) if long_enough(s, min_chars)]
    theirs = {o: [s for s in sentences(o) if long_enough(s, min_chars)] for o in others}
    common_limit = max(2, len(others) / 2)
    overlaps, common = [], 0
    for n, text, key in mine:
        found = []
        for other, rows in theirs.items():
            best = max(
                ((similar(key, k, threshold), on, ot) for on, ot, k in rows),
                default=(0.0, 0, ""),
            )
            if best[0] >= threshold:
                found.append((other, best[1], best[2], best[0]))
        if len(found) >= common_limit:
            common += 1
            continue
        for other, on, ot, ratio in found:
            overlaps.append((n, text, other, on, ot, ratio))
    return overlaps, common


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("post", type=Path)
    parser.add_argument(
        "--posts-dir", type=Path, help="비교할 글 폴더. 기본은 원고와 같은 폴더"
    )
    parser.add_argument(
        "--threshold", type=float, default=0.8, help="겹친다고 볼 유사도(0~1). 기본 0.8"
    )
    parser.add_argument(
        "--min-chars", type=int, default=15, help="비교할 문장의 최소 한글 글자 수. 기본 15"
    )
    args = parser.parse_args(argv)

    if not args.post.is_file():
        print(f"오류: 원고가 없습니다: {args.post}", file=sys.stderr)
        return 2
    folder = args.posts_dir or args.post.parent
    others = sorted(
        p
        for p in folder.glob("*.md")
        if p.resolve() != args.post.resolve() and p.name != args.post.name
    )
    if not others:
        print(f"오류: 비교할 글이 없습니다: {folder}", file=sys.stderr)
        return 2

    overlaps, common = find_overlaps(args.post, others, args.threshold, args.min_chars)
    for n, text, other, on, ot, ratio in overlaps:
        print(f"{args.post.name}:{n} ~ {other.name}:{on} 유사도 {ratio:.2f}")
        print(f"    이 글: {text}")
        print(f"    다른 글: {ot}")
    note = f" (다른 글 절반 이상에 나오는 공통 문구 {common}개는 뺐습니다)" if common else ""
    print(f"다른 글 {len(others)}편과 겹치는 문장 {len(overlaps)}곳{note}")
    return 1 if overlaps else 0


if __name__ == "__main__":
    sys.exit(main())
