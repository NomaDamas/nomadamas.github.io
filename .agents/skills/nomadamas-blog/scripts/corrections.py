#!/usr/bin/env python3
"""사용자가 고쳐 준 지점을 교정 표에 쌓고, 쓰기 전과 검수 때 되돌려 준다.

교정 표는 탭으로 나눈 텍스트다. 값을 따옴표로 감싸지 않는다.
  id          C001부터 차례로 붙는다
  type        검사, 검토, 결정, 이 글만
  pattern     검사 행의 정규식(파이썬 re). 다른 유형은 비운다
  before      고치기 전 문장이나 모습. 예시가 여럿이면 " / "로 나눈다
  after       고친 뒤. 지웠으면 (삭제). 예시 수는 1개이거나 before와 같다
  reason      무엇이 문제였는지 한 줄. 결정 행은 플레이북 절을 함께 적는다
  post        교정을 받은 글의 slug. 여러 글이면 쉼표로 나눈다
  first_seen  처음 받은 날(YYYY-MM-DD)
  last_seen   마지막으로 받은 날
  count       같은 교정을 받은 횟수

유형:
  검사     문장 모양으로 잡히는 교정. check가 pattern으로 원고를 찾는다
  검토     문맥을 봐야 아는 교정. review가 독립 검토자 점검표로 낸다
  결정     글 유형, 틀, 비교 대상, 시연 방식처럼 쓰기 전에 정할 것. 규칙 문장은 플레이북이 정본이다
  이 글만  그 글에만 해당한다. brief와 review에 나오지 않는다

검사 행은 pattern이 before의 모든 예시에 걸리고 after의 어느 예시에도 걸리지 않아야 저장된다.
pattern을 적을 때 --scan <글 폴더>를 주면 발행한 다른 글에서 걸리는 곳을 보여 준다. 오탐이면 좁힌다.

같은 교정을 다시 받으면 hit로 적는다. 횟수가 오르고 다음 단계가 나온다.
  이 글만 -> 다른 글에서도 나왔으면 검토, 검사, 결정 중 하나로 바꾼다
  검토    -> --type 검사 --pattern으로 올리거나 --reason으로 이유를 이번 경우까지 넓혀야 저장된다.
             문맥 검토로 한 번 놓친 모양은 그대로 두면 또 놓친다
  검사    -> 패턴이 이번 문장을 못 잡으면 넓히고, 잡는데도 나왔으면 저장 때 도는 훅을 제안한다
  결정    -> 플레이북에 있는지, 목차를 확인받을 때 이 결정을 따랐는지 본다

결정 행의 규칙 문장은 플레이북에 그 id를 달고 한 번만 적는다. 목차를 확인받기 전에는 플레이북을 읽는다.
brief --type 결정은 결정 행의 반복 횟수와 고치기 전후 예시를 볼 때 쓴다.

예:
  corrections.py list
  corrections.py add --type 검토 --before "..." --after "..." --reason "..." --post <slug>
  corrections.py add --type 검사 --pattern "고릅니다" --before "..." --after "..." --reason "..." --post <slug>
  corrections.py add --type "이 글만" --before "..." --after "..." --reason "..." --post <slug>
  corrections.py hit C007 --before "새로 나온 문장" --after "고친 문장" --post <slug>
  corrections.py hit C013 --type 검사 --pattern "..." --scan <블로그 저장소>/src/content/posts
  corrections.py hit C013 --reason "이번 경우까지 넓힌 이유"
  corrections.py edit C013 --type 검토
  corrections.py brief --type 결정
  corrections.py brief
  corrections.py review
  corrections.py check src/content/posts/<slug>.md

종료 코드: 0 성공, 1 check에 걸린 곳이 있음, 2 입력이나 교정 표 오류
"""

import argparse
import os
import re
import sys
import tempfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from check_post_invariants import facts, prose_lines

TABLE = Path(__file__).resolve().parents[1] / "references" / "corrections.tsv"
COLUMNS = (
    "id",
    "type",
    "pattern",
    "before",
    "after",
    "reason",
    "post",
    "first_seen",
    "last_seen",
    "count",
)
TYPES = ("검사", "검토", "결정", "이 글만")
EXAMPLE_SEP = " / "
DELETED = "(삭제)"
# 쓰기 전에 읽는 요약을 한 화면 안팎으로 묶는 기본 행 수
BRIEF_TOP = 10
# brief 머리 줄의 읽는 때. 유형을 고르지 않으면 원고 쓰기 전이다
BRIEF_WHEN = {
    "결정": "규칙 문장은 플레이북에서 같은 id로 찾는다. 반복 횟수와 고치기 전후 예시를 본다.",
}
# check가 걸린 곳 앞뒤로 보여 주는 글자 수. 문장 하나를 알아볼 만큼만 둔다
CONTEXT = 20
ID_RE = re.compile(r"^C(\d{3,})$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

AFTER_ADD = {
    "검사": "다음: 원고에 check를 돌려 같은 모양이 남았는지 보세요.",
    "검토": "다음: 원고 전체에서 같은 모양을 찾아 함께 고치세요.",
    "결정": "다음: 이 저장소 플레이북의 맞는 절에 이 결정을 적고 규칙 끝에 id를 다세요.",
    "이 글만": "brief와 review에는 나오지 않습니다. 다른 글에서 다시 나오면 hit로 적으세요.",
}


class TableError(Exception):
    """교정 표나 입력이 잘못됐다. 메시지에 고치는 방법을 담는다."""


def clean_cell(value):
    """탭과 줄바꿈은 칸과 행을 깨므로 공백으로 바꾼다."""
    return re.sub(r"[\t\r\n]+", " ", value or "").strip()


def split_examples(cell):
    return [x.strip() for x in cell.split(EXAMPLE_SEP) if x.strip()]


def pairs(row):
    before, after = split_examples(row["before"]), split_examples(row["after"])
    if len(after) == 1:
        after = after * len(before)
    return list(zip(before, after))


def set_examples(row, before, after):
    # 고친 모양이 모두 같으면(예: 전부 삭제) 한 번만 적는다
    if len(after) > 1 and len(set(after)) == 1:
        after = after[:1]
    row["before"] = EXAMPLE_SEP.join(before)
    row["after"] = EXAMPLE_SEP.join(after)


def valid_date(value):
    if not DATE_RE.match(value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def pattern_problems(pattern, before, after):
    if not pattern:
        return [
            "검사 행에는 pattern이 필요합니다. 문장 모양으로 잡을 수 없으면 검토로 적으세요"
        ]
    try:
        rx = re.compile(pattern)
    except re.error as e:
        return [f"pattern {pattern!r}이 정규식으로 컴파일되지 않습니다: {e}"]
    problems = []
    if rx.search("") is not None:
        problems.append("pattern이 빈 문자열에도 걸려 모든 줄에 걸립니다. 좁히세요")
    missed = [b for b in before if not rx.search(b)]
    if missed:
        problems.append(
            f"pattern {pattern!r}이 before 예시를 잡지 못합니다: {missed}. 넓히세요"
        )
    caught = [a for a in after if a != DELETED and rx.search(a)]
    if caught:
        problems.append(
            f"pattern {pattern!r}이 고친 문장에도 걸립니다: {caught}. 좁히세요"
        )
    return problems


def row_problems(row):
    problems = []
    if not ID_RE.match(row["id"]):
        problems.append(f"id {row['id']!r}는 C001 같은 모양이어야 합니다")
    if row["type"] not in TYPES:
        problems.append(f"type {row['type']!r}는 {', '.join(TYPES)} 중 하나여야 합니다")
    for key in ("before", "after", "reason", "post"):
        if not row[key]:
            problems.append(f"{key}가 비었습니다")
    for key in ("first_seen", "last_seen"):
        if not valid_date(row[key]):
            problems.append(f"{key} {row[key]!r}는 YYYY-MM-DD 날짜여야 합니다")
    if (
        valid_date(row["first_seen"])
        and valid_date(row["last_seen"])
        and row["last_seen"] < row["first_seen"]
    ):
        problems.append("last_seen이 first_seen보다 앞섭니다")
    if not row["count"].isdigit() or int(row["count"]) < 1:
        problems.append(f"count {row['count']!r}는 1 이상의 정수여야 합니다")
    before, after = split_examples(row["before"]), split_examples(row["after"])
    if before and after and len(after) not in (1, len(before)):
        problems.append(
            f"after 예시가 {len(after)}개입니다. 1개이거나 before 예시 수({len(before)})와 같아야 합니다"
        )
    if row["type"] == "검사":
        problems += pattern_problems(row["pattern"], before, after)
    elif row["pattern"]:
        problems.append(
            "pattern은 검사 행에만 둡니다. 검사로 바꾸거나 pattern을 비우세요"
        )
    return problems


def validate(rows):
    problems, seen = [], set()
    for i, row in enumerate(rows, 1):
        label = row["id"] or f"{i}번째 행"
        if row["id"] in seen:
            problems.append(f"{label}: id가 겹칩니다")
        seen.add(row["id"])
        problems += [f"{label}: {p}" for p in row_problems(row)]
    return problems


def load(path):
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    if not text.strip():
        return []
    lines = text.split("\n")
    if tuple(lines[0].split("\t")) != COLUMNS:
        raise TableError(
            f"{path} 첫 줄이 머리글과 다릅니다. 첫 줄은 {', '.join(COLUMNS)}를 탭으로 나눈 줄이어야 합니다"
        )
    rows = []
    for n, line in enumerate(lines[1:], 2):
        if not line.strip():
            continue
        cells = line.split("\t")
        if len(cells) != len(COLUMNS):
            raise TableError(
                f"{path}:{n} 칸이 {len(cells)}개입니다. {len(COLUMNS)}개여야 합니다. 값 안에 탭이 들어갔는지 보세요"
            )
        rows.append(dict(zip(COLUMNS, cells)))
    problems = validate(rows)
    if problems:
        raise TableError(
            f"{path}에 잘못된 행이 있습니다. edit로 고치세요.\n  "
            + "\n  ".join(problems)
        )
    return rows


def save(path, rows):
    problems = validate(rows)
    if problems:
        raise TableError("저장하지 않았습니다.\n  " + "\n  ".join(problems))
    lines = ["\t".join(COLUMNS)]
    lines += ["\t".join(clean_cell(row[c]) for c in COLUMNS) for row in rows]
    path.parent.mkdir(parents=True, exist_ok=True)
    # 쓰다가 멈춰도 표가 반쯤 남지 않도록 임시 파일에 쓰고 바꿔 끼운다
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".corrections-", suffix=".tsv")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    if path.exists():
        os.chmod(tmp, path.stat().st_mode)
    else:
        os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def find(rows, rid):
    for row in rows:
        if row["id"] == rid.upper():
            return row
    raise TableError(f"{rid} 행이 없습니다. list로 id를 확인하세요")


def next_id(rows):
    numbers = [int(ID_RE.match(r["id"]).group(1)) for r in rows]
    return f"C{max(numbers, default=0) + 1:03d}"


def day_of(args):
    if args.date is None:
        return date.today().isoformat()
    if not valid_date(args.date):
        raise TableError(f"--date {args.date!r}는 YYYY-MM-DD 날짜여야 합니다")
    return args.date


def new_pairs(before_arg, after_arg):
    before = split_examples(clean_cell(before_arg))
    after = split_examples(clean_cell(after_arg))
    if len(after) == 1:
        after = after * len(before)
    if not before or len(after) != len(before):
        raise TableError(
            f'--before 예시 {len(before)}개와 --after 예시 {len(after)}개가 짝이 맞지 않습니다. 예시는 " / "로 나눕니다'
        )
    return before, after


def add_post(row, slug):
    posts = [p.strip() for p in row["post"].split(",") if p.strip()]
    if slug and slug not in posts:
        posts.append(slug)
    row["post"] = ", ".join(posts)


def cmd_list(args, rows):
    shown = [r for r in rows if args.type is None or r["type"] == args.type]
    for r in shown:
        print(
            f"{r['id']}  {r['type']}  {r['count']}회  {r['last_seen']}  {r['reason']}  ({r['post']})"
        )
    total = f" (전체 {len(rows)}건)" if args.type else ""
    print(f"교정 {len(shown)}건{total}")


def cmd_add(args, rows):
    before, after = new_pairs(args.before, args.after)
    for r in rows:
        if r["type"] == "검사" and any(re.search(r["pattern"], b) for b in before):
            raise TableError(
                f"{r['id']} 검사 규칙이 이미 이 문장을 잡습니다. 같은 교정이면 hit {r['id']}를 쓰세요"
            )
    day = day_of(args)
    row = {
        "id": next_id(rows),
        "type": args.type,
        "pattern": clean_cell(args.pattern),
        "reason": clean_cell(args.reason),
        "post": "",
        "first_seen": day,
        "last_seen": day,
        "count": "1",
    }
    set_examples(row, before, after)
    add_post(row, clean_cell(args.post))
    save(args.table, rows + [row])
    print(f"적었습니다: {row['id']} ({row['type']})")
    print(AFTER_ADD[row["type"]])
    scan_report(row, args.scan)


def hit_message(row, old_type, caught, widened):
    rid, kind = row["id"], row["type"]
    if kind != old_type:
        lead = f"유형을 바꿨습니다: {old_type} -> {kind}. "
        if kind == "검사":
            return lead + "원고에 check를 다시 돌리세요."
        if kind == "결정":
            return lead + AFTER_ADD["결정"]
        return lead.strip()
    if kind == "이 글만":
        return (
            f"다른 글에서 다시 나왔다면 이 글만이 아닙니다. edit {rid} --type 검토로 바꾸세요. "
            "문장 모양으로 잡히면 검사, 글의 방향이면 결정입니다."
        )
    if kind == "검토":
        return (
            "이유를 넓혔습니다. review 점검표에 새 이유가 나옵니다. "
            "다음에 또 나오면 문장 모양으로 잡을 수 있는지 먼저 보세요."
        )
    if kind == "결정":
        return (
            f"플레이북에 {rid}가 달린 규칙이 있는지, 목차를 확인받을 때 그 규칙을 따랐는지 보세요. "
            f"플레이북 문장이 이번 경우를 막지 못했으면 그 문장을 고치고 edit {rid} --reason으로 이유를 넓히세요."
        )
    if widened:
        return "패턴을 바꿨습니다. 원고에 check를 다시 돌리세요."
    if caught:
        return (
            "지금 패턴이 이번 문장을 잡습니다. check를 돌리지 않았거나 걸린 곳을 넘긴 것입니다. "
            "원고를 저장할 때 check를 돌리는 훅을 사용자에게 제안하세요. 전역 설정이라 승인을 받은 뒤 등록합니다."
        )
    return "이번 문장을 --before로 주면 지금 패턴이 잡는지 확인합니다."


def cmd_hit(args, rows):
    row = find(rows, args.id)
    old_type = row["type"]
    old_pattern = row["pattern"]
    if (args.type or old_type) == "검토" and args.reason is None:
        raise TableError(
            f"{row['id']} 검토 교정이 {int(row['count']) + 1}번째입니다. 문맥 검토로 한 번 놓친 모양은 그대로 두면 또 놓칩니다. "
            "문장 모양으로 잡히면 --type 검사 --pattern '<정규식>' --scan <글 폴더>로 올리고, "
            "못 잡으면 --reason으로 이유를 이번 경우까지 넓혀 함께 주세요"
        )
    before = after = []
    if args.before is not None or args.after is not None:
        before, after = new_pairs(args.before, args.after)
    caught = None
    if old_type == "검사" and before:
        caught = all(re.search(old_pattern, b) for b in before)
        if not caught and args.pattern is None:
            raise TableError(
                f"{row['id']} 패턴 {old_pattern!r}이 이번 문장을 잡지 못합니다. "
                "--pattern으로 넓혀 다시 실행하세요"
            )
    if args.type is not None:
        row["type"] = args.type
    if args.pattern is not None:
        row["pattern"] = clean_cell(args.pattern)
    elif row["type"] != "검사":
        row["pattern"] = ""
    if args.reason is not None:
        row["reason"] = clean_cell(args.reason)
    if before:
        old = pairs(row)
        set_examples(
            row,
            [b for b, _ in old] + before,
            [a for _, a in old] + after,
        )
    add_post(row, clean_cell(args.post))
    row["count"] = str(int(row["count"]) + 1)
    row["last_seen"] = max(row["last_seen"], day_of(args))
    save(args.table, rows)
    print(f"{row['id']} {row['type']}, {row['count']}회째입니다.")
    widened = row["type"] == "검사" and row["pattern"] != old_pattern
    print(hit_message(row, old_type, caught, widened))
    if widened:
        scan_report(row, args.scan)


def cmd_edit(args, rows):
    row = find(rows, args.id)
    changed = []
    for key in ("type", "pattern", "before", "after", "reason", "post"):
        value = getattr(args, key)
        if value is not None:
            row[key] = clean_cell(value)
            changed.append(key)
    if not changed:
        raise TableError(
            "바꿀 칸을 하나 이상 주세요: --type, --pattern, --before, --after, --reason, --post"
        )
    if row["type"] != "검사" and row["pattern"] and "pattern" not in changed:
        row["pattern"] = ""
        changed.append("pattern(검사가 아니라서 비움)")
    before, after = split_examples(row["before"]), split_examples(row["after"])
    if len(after) == len(before):
        set_examples(row, before, after)
    save(args.table, rows)
    print(f"고쳤습니다: {row['id']} ({', '.join(changed)})")
    if "pattern" in changed:
        scan_report(row, args.scan)


def by_weight(rows):
    ordered = sorted(rows, key=lambda r: r["id"])
    return sorted(
        ordered, key=lambda r: (int(r["count"]), r["last_seen"]), reverse=True
    )


def print_pairs(row, indent, bullet=""):
    for before, after in pairs(row):
        print(f"{indent}{bullet}전: {before}")
        print(f"{indent}{bullet}후: {after}")


def cmd_brief(args, rows):
    if args.top is not None and args.top < 1:
        raise TableError("--top은 1 이상이어야 합니다")
    pool = [r for r in rows if r["type"] != "이 글만"]
    if args.type:
        pool = [r for r in pool if r["type"] == args.type]
    pool = by_weight(pool)
    if not pool:
        print("지난 교정이 없습니다.")
        return
    # 유형을 고르면 그 유형을 모두 본다. 반복 순으로 자르면 한 번 받은 결정이 빠진다
    top = pool[: args.top or (len(pool) if args.type else BRIEF_TOP)]
    what = f"{args.type} 교정" if args.type else "교정"
    print(
        f"지난 {what} {len(pool)}건 중 {len(top)}건(반복이 많은 순, 같으면 최근 순). "
        + BRIEF_WHEN.get(args.type, "쓰기 전에 읽고 같은 모양을 쓰지 않는다.")
    )
    for r in top:
        print()
        print(f"{r['id']} {r['type']}, {r['count']}회: {r['reason']}")
        print_pairs(r, "    ")


def cmd_review(args, rows):
    groups = (
        ("결정", "결정 (글의 방향과 틀)"),
        ("검토", "검토"),
    )
    shown = [r for r in rows if r["type"] in ("결정", "검토")]
    checked = [r for r in rows if r["type"] == "검사"]
    print("## 지난 교정 점검표")
    print()
    if not shown and not checked:
        print("지난 교정이 없습니다.")
        return
    print(
        "사용자가 앞선 글에서 고쳐 준 지점이다. 원고에서 같은 모양을 찾으면 줄 번호와 고칠 문장을 적는다."
    )
    for kind, title in groups:
        members = by_weight([r for r in shown if r["type"] == kind])
        if not members:
            continue
        print()
        print(f"### {title}")
        print()
        for r in members:
            print(f"- [ ] {r['id']}: {r['reason']}")
            print_pairs(r, "    ", "- ")
    if checked:
        print()
        print(
            "### 검사 (문장 모양은 스크립트가 찾는다. 모양이 다른 같은 실수를 보면 알린다)"
        )
        print()
        for r in by_weight(checked):
            print(f"- {r['id']}: {r['reason']}")


def fixed_example(row, matched):
    """걸린 글자가 든 예시의 고친 모양. 그런 예시가 없으면 첫 예시."""
    examples = pairs(row)
    for before, after in examples:
        if matched in before:
            return after
    return examples[0][1]


def check_rules(rows):
    return [(r, re.compile(r["pattern"])) for r in rows if r["type"] == "검사"]


def find_hits(path, rules):
    """원고 산문에서 검사 행에 걸린 곳. (행 번호, 행, 걸린 글자, 문맥)."""
    f = facts(Path(path).read_text(encoding="utf-8"))
    for n, text in prose_lines(f):
        for r, rx in rules:
            for m in rx.finditer(text):
                start, end = m.span()
                context = text[max(0, start - CONTEXT) : end + CONTEXT].strip()
                yield n, r, m.group(0), context


def scan_report(row, scan_dir):
    """새로 적거나 바꾼 패턴이 발행한 다른 글에서 걸리는 곳을 보여 준다."""
    if scan_dir is None or row["type"] != "검사" or not row["pattern"]:
        return
    posts = sorted(scan_dir.glob("*.md"))
    rules = check_rules([row])
    found = [(p, hit) for p in posts for hit in find_hits(p, rules)]
    print(f"{scan_dir}의 글 {len(posts)}편에서 이 패턴에 걸린 곳 {len(found)}")
    for p, (n, _, matched, context) in found:
        print(f'    {p.name}:{n} "{matched}" 문맥: {context}')
    if found:
        print(
            "    고칠 문장이 아닌 곳이 있으면 오탐이다. "
            f"edit {row['id']} --pattern으로 좁히고 --scan으로 다시 본다."
        )


def cmd_check(args, rows):
    rules = check_rules(rows)
    hits = 0
    for path in args.posts:
        if not Path(path).is_file():
            raise TableError(f"원고가 없습니다: {path}")
        for n, r, matched, context in find_hits(path, rules):
            hits += 1
            print(f'{path}:{n} {r["id"]} "{matched}" 문맥: {context}')
            print(f"    이유: {r['reason']}")
            print(f"    고친 예: {fixed_example(r, matched)}")
    print(f"지난 교정 검사 {len(rules)}개, 걸린 곳 {hits}")
    return 1 if hits else 0


COMMANDS = {
    "list": cmd_list,
    "add": cmd_add,
    "hit": cmd_hit,
    "edit": cmd_edit,
    "brief": cmd_brief,
    "review": cmd_review,
    "check": cmd_check,
}


def build_parser():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--table",
        type=Path,
        default=TABLE,
        help="교정 표 경로. 기본은 이 스킬의 references/corrections.tsv",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("list", help="교정을 한 줄씩 본다")
    p.add_argument("--type", choices=TYPES)

    p = sub.add_parser("add", help="새 교정을 적는다")
    p.add_argument("--type", choices=TYPES, required=True)
    p.add_argument("--pattern", default="", help="검사 행의 정규식")
    p.add_argument(
        "--before", required=True, help='고치기 전. 예시가 여럿이면 " / "로 나눈다'
    )
    p.add_argument("--after", required=True, help=f"고친 뒤. 지웠으면 {DELETED}")
    p.add_argument("--reason", required=True, help="무엇이 문제였는지 한 줄")
    p.add_argument("--post", required=True, help="교정을 받은 글의 slug")
    p.add_argument("--date", help="교정을 받은 날(YYYY-MM-DD). 기본은 오늘")
    p.add_argument(
        "--scan",
        type=Path,
        help="검사 패턴을 저장한 뒤 이 폴더의 글(*.md)에서 걸리는 곳을 보여 준다. 오탐 확인용",
    )

    p = sub.add_parser(
        "hit", help="같은 교정을 다시 받았다. 횟수를 올리고 다음 단계를 알려 준다"
    )
    p.add_argument("id")
    p.add_argument("--before", help="이번에 고친 문장. 예시로 덧붙는다")
    p.add_argument("--after", help="이번 문장을 고친 모양")
    p.add_argument("--type", choices=TYPES, help="유형을 함께 바꿀 때")
    p.add_argument("--pattern", help="검사 패턴을 바꿀 때")
    p.add_argument("--post", help="이번에 교정을 받은 글의 slug")
    p.add_argument("--date", help="교정을 받은 날(YYYY-MM-DD). 기본은 오늘")
    p.add_argument(
        "--reason",
        help="이유를 이번 경우까지 넓혀 바꿀 때. 검토 행을 검사로 올리지 않으면 필수",
    )
    p.add_argument(
        "--scan",
        type=Path,
        help="검사 패턴을 저장한 뒤 이 폴더의 글(*.md)에서 걸리는 곳을 보여 준다. 오탐 확인용",
    )

    p = sub.add_parser("edit", help="행의 칸을 바꾼다. 횟수와 날짜는 그대로다")
    p.add_argument("id")
    p.add_argument("--type", choices=TYPES)
    p.add_argument("--pattern")
    p.add_argument("--before")
    p.add_argument("--after")
    p.add_argument("--reason")
    p.add_argument("--post")
    p.add_argument(
        "--scan",
        type=Path,
        help="검사 패턴을 저장한 뒤 이 폴더의 글(*.md)에서 걸리는 곳을 보여 준다. 오탐 확인용",
    )

    p = sub.add_parser("brief", help="쓰기 전에 읽을 지난 교정 요약")
    p.add_argument(
        "--top",
        type=int,
        help=f"보여 줄 행 수. 기본은 {BRIEF_TOP}개, --type을 주면 그 유형 전부",
    )
    p.add_argument(
        "--type",
        choices=("검사", "검토", "결정"),
        help="이 유형만 본다",
    )

    sub.add_parser("review", help="독립 검토자에게 줄 점검표(markdown)")

    p = sub.add_parser(
        "check", help="원고에서 검사 행의 패턴을 찾는다. 걸리면 종료 코드 1"
    )
    p.add_argument("posts", nargs="+", metavar="post.md")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        scan = getattr(args, "scan", None)
        if scan is not None and not scan.is_dir():
            raise TableError(f"--scan 폴더가 없습니다: {scan}")
        rows = load(args.table)
        return COMMANDS[args.command](args, rows) or 0
    except TableError as e:
        print(f"오류: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
