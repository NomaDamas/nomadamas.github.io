#!/usr/bin/env python3
"""블로그 원고의 윤문 전후를 비교해 바뀌면 안 되는 것이 그대로인지 확인한다.

사용:
  check_post_invariants.py <before.md> <after.md>                전후 비교와 after 검사
  check_post_invariants.py --published <발행본.md> <고친 원고.md>  발행 뒤 수정을 발행본과 비교
  check_post_invariants.py <post.md>                             원고 하나만 검사
  check_post_invariants.py --commas <post.md>                    원고 하나의 연결어미 뒤 쉼표를 모두 보인다

오류(종료 코드 1): 고친 뒤 다시 돌린다
  - frontmatter의 값 필드(날짜, 태그, 이미지, featured 등)가 바뀌거나 생기거나 사라짐
  - 코드 블록이 바뀜
  - 이미지 참조(경로)가 바뀜. --published에서는 사라진 이미지만 오류다
  - 금지 기호가 있음: 오른쪽 화살표, em dash, 가운뎃점, 동그라미 숫자, 섹션 기호
    (본문과 frontmatter의 title, description을 본다. 코드 블록, 인라인 코드, 주소 안은 보지 않는다)

경고(종료 코드 0): 하나씩 보고 판단한다
  - frontmatter의 title, description 문장이 바뀜. 뜻이 같으면 그대로 둔다
  - 전후로 사라지거나 새로 생긴 링크 주소, 인라인 코드, 숫자
    중복 문장을 지워 사라진 것이면 그대로 두고, 뜻이 바뀐 것이면 되돌린다
  - 전후 비교에서 새로 생긴 연결어미 뒤 쉼표(-고, -며, -지만, -면서, -아서/-어서와 준말, -는데, -인데 바로 뒤)
    AI 티로 읽힌다(humanize-korean C-11). 쉼표를 빼거나 문장을 끊는다
  - --published에서 새로 넣은 이미지와 바뀐 modDatetime. 의도한 수정이면 그대로 둔다
  - 이미지, 영상, 임베드가 없는 ## 절(목차, 마치며, 자주 묻는 질문, 참고 자료는 뺀다)
    그 절이 다루는 대상을 보여 주는 자료를 넣거나, 넣지 않는 이유를 보고에 적는다
  - 물결표 짝이 맞는 문단. 줄이 달라도 한 문단 안이면 짝이 되고, 제목, 목록 항목, 표 칸,
    링크 글자, 이미지 대체 텍스트는 각각 따로 짝을 짓는다. 본문은 그 사이가 취소선이 되고 대체
    텍스트는 물결표가 지워진다. 범위는 "부터, 까지"로 풀어 쓴다
"""

import argparse
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

# 전역 AI티 금지 규칙의 기호. 이 파일이 그 규칙을 어기지 않도록 코드 포인트로 적는다
BANNED = {
    "\u2192": "오른쪽 화살표(-> 로 쓴다)",
    "\u2014": "em dash(- 로 쓴다)",
    "\u00b7": "가운뎃점(, 나 / 로 쓴다)",
    "\u00a7": "섹션 기호(빼고 절 번호만 쓴다)",
}
BANNED.update(
    {chr(c): "동그라미 숫자(1. 2. 3. 으로 쓴다)" for c in range(0x2460, 0x2474)}
)

# 윤문이 다듬어도 되는 frontmatter 문장 필드. 나머지 필드는 값이라 바뀌면 안 된다
PROSE_KEYS = ("title", "description")
# 발행한 날과 다른 날 고치면 적는 필드라 발행본 비교에서는 바뀌어도 된다
PUBLISHED_FIX_KEYS = ("modDatetime",)
# 길잡이와 마무리 절이라 그 절이 보여 줄 대상이 따로 없다
TEXT_ONLY_SECTIONS = ("목차", "마치며", "자주 묻는 질문", "참고 자료")

# 연결어미 뒤 쉼표. 윤문에서 지운 뒤 편집하다 다시 생기기 쉬워 전후 비교에서 새로 생긴 것만 알린다.
# 이미 발행한 글에는 수십 곳씩 남아 있어 파일 하나만 볼 때는 알리지 않는다.
# -자는 개발자, 연구자처럼 같은 끝의 명사가 많아 -하자, -되자만 넣었다.
# 줄어든 -아서/-어서(줘서, 생겨서), -이라(서), -인데도 같은 쉼표다
CONNECTIVE_ENDINGS = (
    "고", "며", "지만", "면서", "면서도", "아서", "어서", "여서", "해서", "라서", "이라",
    "는데", "은데", "인데", "하자", "되자",
    "줘서", "봐서", "와서", "돼서", "워서", "겨서", "져서", "쳐서", "춰서", "꿔서", "둬서", "켜서",
)
# 문장 첫머리 접속 부사, -고로 끝나는 흔한 명사, 어미와 같은 꼴의 낱말은 연결어미가 아니다
NOT_CONNECTIVE = {
    "그리고", "하지만", "그렇지만", "그러면서", "그러고", "그런데",
    "광고", "공고", "재고", "최고", "참고", "원고", "경고", "창고", "신고", "사고", "잔고",
    "어서", "아서", "하자",
}
COMMA_WORD_RE = re.compile(r"([가-힣]+),")

FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)
KEY_RE = re.compile(r"^([A-Za-z_][\w-]*):(.*)$")
# 목록 안에 들여쓴 코드 블록도 잡는다. 닫는 울타리는 여는 것과 같은 길이다
FENCE_RE = re.compile(r"^[ \t]*(`{3,}|~{3,})[^\n]*\n.*?^[ \t]*\1[ \t]*$", re.S | re.M)
INLINE_CODE_RE = re.compile(r"(`+)(.+?)\1")
# 대체 텍스트와 링크 글자 안의 대괄호 한 겹("'[견적 요청] 오늘'은")까지 받는다. 못 받으면 그 이미지를 통째로 놓친다
BRACKETED = r"\[(?:[^\[\]]|\[[^\[\]]*\])*\]"
IMAGE_RE = re.compile(rf"!{BRACKETED}\(\s*([^)\s]+)")
LINK_RE = re.compile(rf"(?<!!){BRACKETED}\(\s*([^)\s]+)")
TARGET_RE = re.compile(r"\]\(\s*[^)\s]+[^)\n]*\)")
URL_RE = re.compile(r"https?://[^\s)>\]\"']+")
NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)*")
H2_RE = re.compile(r"^## (.+?)\s*$")
FENCE_OPEN_RE = re.compile(r"^[ \t]*(`{3,}|~{3,})")
TABLE_ROW_RE = re.compile(r"^[ \t]*\|")
HEADING_RE = re.compile(r"^[ \t]*#{1,6}[ \t]")
LIST_ITEM_RE = re.compile(r"^[ \t]*(?:[-*+]|\d+[.)])[ \t]")
QUOTE_RE = re.compile(r"^(?:[ \t]*>[ \t]?)+")
# 링크 글자와 대체 텍스트도 대괄호 한 겹까지 받는다. 못 받으면 그 글자를 본문으로 보고 물결표 짝을 잘못 짓는다
LINK_LABEL_RE = re.compile(r"!?\[((?:[^\[\]\n]|\[[^\[\]\n]*\])*)\]\([^)\n]*\)")
TILDE_RUN_RE = re.compile(r"~+")
VISUAL_RE = re.compile(rf"!{BRACKETED}\(|<(?:img|video|object|iframe)\b", re.I)


def blank(match):
    """줄 번호와 열 위치가 유지되도록 같은 길이의 공백으로 바꾼다."""
    return re.sub(r"[^\n]", " ", match.group(0))


def frontmatter_fields(frontmatter):
    """최상위 키별 (값 원문, 시작 행 번호 목록). 들여쓴 줄과 목록 줄은 앞 키에 붙인다."""
    fields = {}
    key = None
    # 파일 1행이 여는 ---라서 frontmatter 첫 줄은 2행이다
    for lineno, line in enumerate(frontmatter.split("\n"), 2):
        m = KEY_RE.match(line)
        if m:
            key = m.group(1)
            fields[key] = {"value": m.group(2).strip(), "lines": [(lineno, m.group(2))]}
        elif key is not None:
            fields[key]["value"] += "\n" + line
            fields[key]["lines"].append((lineno, line))
    return fields


def facts(text):
    m = FRONTMATTER_RE.match(text)
    body = text[m.end() :] if m else text
    offset = text[: m.end()].count("\n") if m else 0
    prose = FENCE_RE.sub(blank, body)
    clean = URL_RE.sub(blank, TARGET_RE.sub(blank, INLINE_CODE_RE.sub(blank, prose)))
    return {
        "fields": frontmatter_fields(m.group(1)) if m else {},
        "fences": [f.group(0) for f in FENCE_RE.finditer(body)],
        "images": Counter(IMAGE_RE.findall(prose)),
        "links": set(LINK_RE.findall(prose)) | set(URL_RE.findall(prose)),
        "inline_code": {c.group(2) for c in INLINE_CODE_RE.finditer(prose)},
        "numbers": set(NUMBER_RE.findall(clean)),
        "body": body,
        "prose": prose,
        "clean": clean,
        "offset": offset,
    }


def prose_lines(f):
    """(행 번호, 줄) 목록. frontmatter의 title, description 줄과 코드, 주소를 비운 본문 줄이다."""
    lines = [
        (n, t)
        for key in PROSE_KEYS
        if key in f["fields"]
        for n, t in f["fields"][key]["lines"]
    ]
    return lines + list(enumerate(f["clean"].split("\n"), f["offset"] + 1))


def banned_hits(f):
    return [
        f"{n}행: {name}"
        for n, text in prose_lines(f)
        for ch, name in BANNED.items()
        if ch in text
    ]


def is_connective(word):
    """연결어미로 끝나는 말인지.

    한 글자 어미(-고, -며)는 그보다 긴 말만 본다. 두 글자 이상은 '보여 줘서'처럼
    띄어 쓴 보조 동사가 어미와 같은 길이로 끊기므로 같은 길이도 본다.
    """
    return word not in NOT_CONNECTIVE and any(
        word.endswith(e) and (len(word) > len(e) or len(e) > 1) for e in CONNECTIVE_ENDINGS
    )


def connective_commas(f):
    """(행 번호, 말) 목록. 연결어미로 끝나는 말 바로 뒤에 쉼표가 온 곳이다."""
    return [
        (n, word)
        for n, text in prose_lines(f)
        for word in COMMA_WORD_RE.findall(text)
        if is_connective(word)
    ]


def comma_lines(f, width=30):
    """--commas 출력 줄. 행 번호와 쉼표 앞뒤 문맥이다. 코드와 주소 자리는 공백으로 보인다."""
    out = []
    for n, text in prose_lines(f):
        for m in COMMA_WORD_RE.finditer(text):
            if is_connective(m.group(1)):
                before = text[max(0, m.start() - width) : m.end()].lstrip()
                after = text[m.end() : m.end() + width].rstrip()
                out.append(f"{n}행: {before}{after}")
    return out


def new_connective_commas(before, after):
    """after에만 있는 연결어미 뒤 쉼표. 같은 말이 전후로 같은 수만큼 있으면 그대로 둔 것으로 본다."""
    left = Counter(word for _, word in connective_commas(before))
    found = []
    for n, word in connective_commas(after):
        if left[word]:
            left[word] -= 1
        else:
            found.append(f"{n}행 '{word},'")
    return found


def sections_without_visuals(f):
    """(행 번호, 절 제목, 대신 있는 것) 목록. 이미지, 영상, 임베드가 하나도 없는 ## 절이다.

    대신 있는 것은 표나 코드 블록이다. 명령이나 비교표로 보이는 절인지 판단을 돕는다.
    """
    sections = []
    lines = zip(f["prose"].split("\n"), f["body"].split("\n"))
    for n, (line, raw) in enumerate(lines, f["offset"] + 1):
        m = H2_RE.match(line)
        if m:
            sections.append({"n": n, "title": m.group(1), "visuals": 0, "other": set()})
            continue
        if not sections:
            continue
        if VISUAL_RE.search(line):
            sections[-1]["visuals"] += 1
        if TABLE_ROW_RE.match(line):
            sections[-1]["other"].add("표")
        if FENCE_OPEN_RE.match(raw):
            sections[-1]["other"].add("코드 블록")
    return [
        (s["n"], s["title"], ", ".join(sorted(s["other"])))
        for s in sections
        if s["visuals"] == 0 and s["title"] not in TEXT_ONLY_SECTIONS
    ]


def char_kind(c):
    """물결표 앞뒤 글자의 갈래. micromark처럼 공백, 문장 부호와 기호, 그 밖의 글자로 나눈다."""
    if not c or c.isspace():
        return "space"
    if unicodedata.category(c)[0] in "PS":
        return "punct"
    return "other"


def has_tilde_pair(text):
    """remark-gfm이 취소선으로 읽는 물결표 짝이 있는지. 여닫는 조건은 micromark를 따른다."""
    openers = []
    for m in TILDE_RUN_RE.finditer(text):
        size = len(m.group(0))
        if size > 2:
            continue
        before = char_kind(text[m.start() - 1 : m.start()])
        after = char_kind(text[m.end() : m.end() + 1])
        if size in openers and (
            before == "other" or (before == "punct" and after != "other")
        ):
            return True
        if after == "other" or (after == "punct" and before != "other"):
            openers.append(size)
    return False


def split_labels(text):
    """(링크 글자와 대체 텍스트를 비운 줄, 링크 글자와 대체 텍스트 목록)."""
    labels = [m.group(1) for m in LINK_LABEL_RE.finditer(text)]
    return URL_RE.sub(blank, LINK_LABEL_RE.sub(blank, text)), labels


def tilde_blocks(f):
    """물결표 짝이 맞는 곳의 첫 행 번호. 코드와 주소 안은 보지 않는다.

    remark-gfm은 문단, 제목, 목록 항목, 표 칸마다 물결표 짝을 짓고, 줄이 달라도 한 문단이면
    짝이 된다. 링크 글자와 이미지 대체 텍스트 안은 그 안에서만 짝을 짓는다.
    """
    found = set()
    block = None  # [첫 행 번호, 링크 글자 밖 줄 목록]

    def close():
        if block and has_tilde_pair("\n".join(block[1])):
            found.add(block[0])

    text_only = INLINE_CODE_RE.sub(blank, f["prose"])
    for n, line in enumerate(text_only.split("\n"), f["offset"] + 1):
        text = QUOTE_RE.sub("", line).strip()
        if not text or TABLE_ROW_RE.match(text) or HEADING_RE.match(text):
            close()
            block = None
            # 제목은 한 줄, 표는 칸 하나가 한 덩어리다
            for part in text.split("|") if TABLE_ROW_RE.match(text) else [text]:
                outside, labels = split_labels(part)
                if any(map(has_tilde_pair, [outside, *labels])):
                    found.add(n)
            continue
        outside, labels = split_labels(text)
        if any(map(has_tilde_pair, labels)):
            found.add(n)
        if block is None or LIST_ITEM_RE.match(text):
            close()
            block = [n, []]
        block[1].append(outside)
    close()
    return sorted(found)


def compare(before, after, published=False):
    errors, warnings = [], []
    fb, fa = before["fields"], after["fields"]
    for key in sorted(set(fb) | set(fa)):
        old = fb.get(key, {}).get("value")
        new = fa.get(key, {}).get("value")
        if old == new:
            continue
        if key in PROSE_KEYS and old is not None and new is not None:
            warnings.append(
                f"frontmatter {key} 문장이 바뀌었습니다. 뜻이 같은지 확인하세요"
            )
        elif published and key in PUBLISHED_FIX_KEYS:
            warnings.append(
                f"frontmatter {key} 값이 바뀌었습니다: {old!r} -> {new!r}. 발행과 다른 날 독자가 읽는 내용을 고친 것인지 확인하세요. 글 목록이 이 값으로 정렬됩니다"
            )
        else:
            errors.append(f"frontmatter {key} 값이 바뀌었습니다: {old!r} -> {new!r}")
    if before["fences"] != after["fences"]:
        errors.append(
            f"코드 블록이 바뀌었습니다 (전 {len(before['fences'])}개, 후 {len(after['fences'])}개)"
        )
    if before["images"] != after["images"]:
        gone = sorted((before["images"] - after["images"]).elements())
        new = sorted((after["images"] - before["images"]).elements())
        if not published:
            errors.append(
                f"이미지 참조가 바뀌었습니다. 사라짐: {gone or '없음'}, 생김: {new or '없음'}"
            )
        else:
            if gone:
                errors.append(f"발행본의 이미지가 사라졌습니다: {gone}")
            if new:
                warnings.append(f"새로 넣은 이미지: {new}")
    for key, label in (
        ("links", "링크 주소"),
        ("inline_code", "인라인 코드"),
        ("numbers", "숫자"),
    ):
        gone = sorted(before[key] - after[key])
        new = sorted(after[key] - before[key])
        if gone:
            warnings.append(f"사라진 {label}: {gone}")
        if new:
            warnings.append(f"새로 생긴 {label}: {new}")
    commas = new_connective_commas(before, after)
    if commas:
        warnings.append(
            f"새로 생긴 연결어미 뒤 쉼표: {', '.join(commas)}. 쉼표를 빼거나 문장을 끊으세요"
        )
    return errors, warnings


def check_post(f):
    """원고 하나에 대한 (오류, 경고)."""
    errors = [f"금지 기호 {h}" for h in banned_hits(f)]
    warnings = [
        f"{n}행 '{title}' 절에 이미지나 영상이 없습니다{f'({other}만 있음)' if other else ''}. "
        "그 절이 다루는 대상을 보여 주는 자료를 넣거나, 넣지 않는 이유를 보고에 적으세요"
        for n, title, other in sections_without_visuals(f)
    ]
    warnings += [
        f"{n}행에서 시작하는 문단에 짝이 맞는 물결표가 있습니다. 본문은 그 사이가 취소선으로 그려지고 "
        "대체 텍스트는 물결표가 지워집니다(줄이 달라도 한 문단이면 짝이 됩니다). 범위는 '부터, 까지'로 쓰세요"
        for n in tilde_blocks(f)
    ]
    return errors, warnings


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--published",
        action="store_true",
        help="before가 발행본이다. 새로 넣은 이미지와 modDatetime은 경고로 낸다",
    )
    parser.add_argument(
        "--commas",
        action="store_true",
        help="원고 하나의 연결어미 뒤 쉼표를 문맥과 함께 모두 보인다. 발행한 글에 남은 쉼표를 지울 때 쓴다",
    )
    parser.add_argument(
        "files",
        nargs="+",
        metavar="md",
        help="before.md after.md, 또는 검사할 원고 하나",
    )
    args = parser.parse_args(argv)
    if len(args.files) > 2:
        parser.error("파일은 하나(원고 검사) 또는 둘(전후 비교)만 받습니다.")
    if args.published and len(args.files) != 2:
        parser.error("--published는 발행본과 고친 원고 두 파일을 받습니다.")
    if args.commas and (len(args.files) != 1 or args.published):
        parser.error("--commas는 원고 하나만 받습니다.")
    texts = []
    for path in args.files:
        p = Path(path)
        if not p.is_file():
            parser.error(f"파일이 없습니다: {path}")
        texts.append(p.read_text(encoding="utf-8"))

    after = facts(texts[-1])
    if args.commas:
        lines = comma_lines(after)
        print("\n".join(lines + [f"연결어미 뒤 쉼표 {len(lines)}곳. 문맥을 보고 하나씩 지운다"]))
        return 0
    errors, warnings = [], []
    if len(texts) == 2:
        errors, warnings = compare(facts(texts[0]), after, args.published)
    post_errors, post_warnings = check_post(after)
    errors += post_errors
    warnings += post_warnings

    for e in errors:
        print(f"오류: {e}")
    for w in warnings:
        print(f"경고: {w}")
    if not errors and not warnings:
        print("통과: 바뀐 것이 없고 금지 기호도 없습니다")
    elif not errors:
        print("오류 없음. 경고를 하나씩 확인하세요")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
