#!/usr/bin/env python3
"""tmux로 뜬 터미널 화면(ANSI)을 블로그용 PNG로 렌더링한다.

화면을 HTML로 옮겨 headless Chrome으로 찍는다. 글자 색과 굵기, 상자 그리는 문자,
블록 문자를 살리고, 강조 상자와 라벨을 얹는다.

캡처:
  tmux -L demo capture-pane -p -e -t demo > caps/01-name.ansi

사용:
  render_terminal.py rows caps/01-name.ansi          행 번호와 평문. 자를 구간과 강조할 행을 고를 때 쓴다
  render_terminal.py build spec.json [이름 ...]      spec의 이미지를 PNG로 만든다. 이름을 주면 그것만 만든다
"""

import argparse
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

SPEC_HELP = """\
spec.json 형식 (행과 열 번호는 0부터, 구간은 양끝 포함):
{
  "outdir": "shots/edited",
  "images": [
    {
      "name": "01-install",                 출력 파일 이름. <outdir>/01-install.png
      "src": "caps/01-name.ansi",           캡처 파일. rows 명령의 행 번호를 쓴다
      "rows": [19, 43],                     자를 행 구간
      "segments": [                         여러 캡처를 이어 붙일 때 src, rows 대신 쓴다
        {"src": "caps/a.ansi", "rows": [0, 5]}, "blank", {"src": "caps/b.ansi", "rows": [3, 9]}
      ],
      "cols": [0, 116],                     자를 열 구간(선택)
      "nobg_rows": [3],                     배경색을 지울 행. 이미지 안 번호(선택)
      "extra_w": 380,                       오른쪽 라벨 자리 폭 px(선택, 기본 380)
      "boxes": [
        {
          "r0": 7, "r1": 7,                 강조할 행. 이미지 안 번호
          "find": "local scope",            r0 행에서 이 문자열 폭만 강조(선택)
          "c0": 4, "c1": 30,                열을 직접 줄 때(선택)
          "kind": "bar",                    outline(테두리) 또는 bar(옅은 배경과 왼쪽 막대)
          "color": "green",                 green(해결, 정답), orange(주의), red(문제)
          "fill": "green-strong",           outline 안을 칠할 때(선택). <색> 또는 <색>-strong
          "label": "짧은 설명",              알약 모양 라벨(선택)
          "label_row": 8, "label_col": 17,  라벨 위치. 없으면 상자 오른쪽(선택)
          "label_dy": 6                     라벨 세로 미세 조정 px(선택)
        }
      ]
    }
  ]
}

전체 화면 터미널 앱은 줄 간격이 좁아 outline이 옆 줄 글자를 긋는다. bar를 쓴다.
상자 위치는 D2Coding 글자 폭(라틴 0.5em)을 기준으로 계산하므로 D2Coding이 설치돼 있어야 맞다.
"""

DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FONT_DIRS = ("~/Library/Fonts", "/Library/Fonts", "/System/Library/Fonts")

BG = (15, 17, 20)
FG = "#d4d7dc"
FONT_PX = 15
CH = FONT_PX * 0.5  # D2Coding 라틴 글자 폭이 0.5em이라 열 번호를 px로 바꿀 때 쓴다
LH = round(FONT_PX * 1.5)
PAD = 28
CROP_MARGIN = 40  # 내용 둘레에 남길 여백 px(2배 해상도 기준)
COLOR = {"green": "#3fb950", "orange": "#e0a028", "red": "#f85149"}
FILL = {
    "green": "rgba(63,185,80,0.13)",
    "orange": "rgba(224,160,40,0.13)",
    "red": "rgba(248,81,73,0.13)",
    "green-strong": "rgba(63,185,80,0.27)",
    "orange-strong": "rgba(224,160,40,0.30)",
    "red-strong": "rgba(248,81,73,0.27)",
}

BASIC = [
    "#484f58",
    "#ff7b72",
    "#3fb950",
    "#d29922",
    "#58a6ff",
    "#bc8cff",
    "#39c5cf",
    "#b1bac4",
    "#6e7681",
    "#ffa198",
    "#56d364",
    "#e3b341",
    "#79c0ff",
    "#d2a8ff",
    "#56d4dd",
    "#ffffff",
]


class SpecError(Exception):
    """spec이 캡처와 맞지 않을 때. 메시지에 고칠 방법을 담는다."""


def xterm256(n):
    if n < 16:
        return BASIC[n]
    if n < 232:
        n -= 16
        steps = [0, 95, 135, 175, 215, 255]
        return "#%02x%02x%02x" % (steps[n // 36], steps[(n // 6) % 6], steps[n % 6])
    v = 8 + (n - 232) * 10
    return "#%02x%02x%02x" % (v, v, v)


SGR = re.compile(r"\x1b\[([0-9;:]*)m")
# 색(SGR, 끝 글자 m)은 남기고 커서 이동 같은 나머지 제어 코드만 지운다
OTHER_ESC = re.compile(
    r"\x1b\[[0-9;?]*[A-Za-ln-z]|\x1b\][^\x07]*\x07|\x1b[()][0-9A-Za-z]"
)


def new_style():
    return {
        "fg": None,
        "bg": None,
        "b": False,
        "d": False,
        "i": False,
        "u": False,
        "inv": False,
        "s": False,
    }


def parse_line(line):
    """한 줄을 (문자, 스타일) 목록으로 바꾼다."""
    st = new_style()
    out = []
    pos = 0
    line = OTHER_ESC.sub("", line)
    for m in SGR.finditer(line):
        for ch in line[pos : m.start()]:
            out.append((ch, dict(st)))
        pos = m.end()
        params = [
            int(p) if p.isdigit() else 0 for p in re.split(r"[;:]", m.group(1))
        ] or [0]
        k = 0
        while k < len(params):
            p = params[k]
            if p == 0:
                st = new_style()
            elif p == 1:
                st["b"] = True
            elif p == 2:
                st["d"] = True
            elif p == 3:
                st["i"] = True
            elif p == 4:
                st["u"] = True
            elif p == 7:
                st["inv"] = True
            elif p == 9:
                st["s"] = True
            elif p == 22:
                st["b"] = st["d"] = False
            elif p == 23:
                st["i"] = False
            elif p == 24:
                st["u"] = False
            elif p == 27:
                st["inv"] = False
            elif p == 29:
                st["s"] = False
            elif 30 <= p <= 37:
                st["fg"] = BASIC[p - 30]
            elif 90 <= p <= 97:
                st["fg"] = BASIC[p - 90 + 8]
            elif 40 <= p <= 47:
                st["bg"] = BASIC[p - 40]
            elif 100 <= p <= 107:
                st["bg"] = BASIC[p - 100 + 8]
            elif p == 39:
                st["fg"] = None
            elif p == 49:
                st["bg"] = None
            elif p in (38, 48):
                key = "fg" if p == 38 else "bg"
                if k + 2 < len(params) and params[k + 1] == 5:
                    st[key] = xterm256(params[k + 2])
                    k += 2
                elif k + 4 < len(params) and params[k + 1] == 2:
                    st[key] = "#%02x%02x%02x" % tuple(params[k + 2 : k + 5])
                    k += 4
            k += 1
    for ch in line[pos:]:
        out.append((ch, dict(st)))
    return out


def width(ch):
    if unicodedata.combining(ch):
        return 0
    return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1


def dwidth(text):
    return sum(width(c) for c in text)


def load(path):
    p = Path(path)
    if not p.is_file():
        raise SpecError(f"캡처 파일이 없습니다: {path}. spec의 src 경로를 확인하세요.")
    return p.read_text(encoding="utf-8", errors="replace").rstrip("\n").split("\n")


def plain(line):
    return "".join(c for c, _ in parse_line(line))


# 상자 문자: (위, 아래, 왼쪽, 오른쪽) 선분. 폰트 글리프 대신 선으로 그려 줄 사이가 끊기지 않게 한다
BOX = {
    "─": (0, 0, 1, 1),
    "│": (1, 1, 0, 0),
    "┌": (0, 1, 0, 1),
    "┐": (0, 1, 1, 0),
    "└": (1, 0, 0, 1),
    "┘": (1, 0, 1, 0),
    "├": (1, 1, 0, 1),
    "┤": (1, 1, 1, 0),
    "┬": (0, 1, 1, 1),
    "┴": (1, 0, 1, 1),
    "┼": (1, 1, 1, 1),
    "╭": (0, 1, 0, 1),
    "╮": (0, 1, 1, 0),
    "╰": (1, 0, 0, 1),
    "╯": (1, 0, 1, 0),
}
# 블록 문자: (좌상, 우상, 좌하, 우하) 사분면
QUAD = {
    "█": (1, 1, 1, 1),
    "▐": (0, 1, 0, 1),
    "▌": (1, 0, 1, 0),
    "▀": (1, 1, 0, 0),
    "▄": (0, 0, 1, 1),
    "▛": (1, 1, 1, 0),
    "▜": (1, 1, 0, 1),
    "▙": (1, 0, 1, 1),
    "▟": (0, 1, 1, 1),
    "▝": (0, 1, 0, 0),
    "▘": (1, 0, 0, 0),
    "▗": (0, 0, 0, 1),
    "▖": (0, 0, 1, 0),
    "▚": (1, 0, 0, 1),
    "▞": (0, 1, 1, 0),
}


def glyph_css(ch, color):
    g = f"linear-gradient({color},{color})"
    if ch in BOX:
        up, down, left, right = BOX[ch]
        layers = []
        if up and down:
            layers.append(f"{g} center top/1.2px 100% no-repeat")
        elif up:
            layers.append(f"{g} center top/1.2px 50% no-repeat")
        elif down:
            layers.append(f"{g} center bottom/1.2px 50% no-repeat")
        if left and right:
            layers.append(f"{g} left center/100% 1.2px no-repeat")
        elif left:
            layers.append(f"{g} left center/50% 1.2px no-repeat")
        elif right:
            layers.append(f"{g} right center/50% 1.2px no-repeat")
        return "background:" + ",".join(layers) + ";"
    if ch in QUAD:
        pos = ["left top", "right top", "left bottom", "right bottom"]
        layers = [
            f"{g} {pos[k]}/50% 50% no-repeat" for k, on in enumerate(QUAD[ch]) if on
        ]
        return "background:" + ",".join(layers) + ";"
    if ch == "▔":
        return f"background:{g} left top/100% 2px no-repeat;"
    if ch == "░":
        return f"background:{color};opacity:0.35;"
    return None


def cell_style(st):
    fg, bg = st["fg"] or FG, st["bg"]
    if st["inv"]:
        fg, bg = (st["bg"] or "#0f1114"), (st["fg"] or FG)
    css = f"color:{fg};"
    if bg:
        css += f"background-color:{bg};"
    if st["b"]:
        css += "font-weight:700;"
    if st["d"]:
        css += "opacity:0.62;"
    if st["i"]:
        css += "font-style:italic;"
    deco = []
    if st["u"]:
        deco.append("underline")
    if st["s"]:
        deco.append("line-through")
    if deco:
        css += "text-decoration:" + " ".join(deco) + ";"
    return css, fg


def row_html(line, c0, c1, nobg=False):
    cells = parse_line(line)
    if nobg:
        cells = [(ch, {**st, "bg": None, "inv": False}) for ch, st in cells]
    col = 0
    parts = []
    run, run_css = [], None

    def flush():
        nonlocal run, run_css
        if run:
            parts.append(f'<span style="{run_css}">{html.escape("".join(run))}</span>')
        run, run_css = [], None

    for ch, st in cells:
        w = width(ch)
        if w == 0:
            continue
        if col + w <= c0 or col >= c1:
            col += w
            continue
        css, fg = cell_style(st)
        special = glyph_css(ch, fg)
        if ch.isascii() and special is None:
            if run_css != css:
                flush()
                run_css = css
            run.append(ch)
        else:
            # 넓은 글자와 그림 문자는 칸 폭을 고정해 열 위치가 밀리지 않게 한다
            flush()
            inner = "" if special is not None else html.escape(ch)
            parts.append(
                f'<span class="g" style="width:{w}ch;{css}{special or ""}">{inner}</span>'
            )
        col += w
    flush()
    return "".join(parts)


def resolve_box(b, rows):
    """find가 있으면 그 문자열의 표시 폭으로 c0, c1을 계산한다. 행 번호는 이미지 안 기준(0부터)."""
    b = dict(b)
    for key in ("r0", "r1"):
        if key not in b:
            raise SpecError(
                f"상자에 {key}가 없습니다: {b}. 강조할 행 번호(이미지 안 기준)를 넣으세요."
            )
        if not 0 <= b[key] < len(rows):
            raise SpecError(
                f"상자 {key}={b[key]}가 이미지 행 범위(0~{len(rows) - 1}) 밖입니다. rows 구간 안의 번호를 쓰세요."
            )
    if b.get("color", "green") not in COLOR:
        raise SpecError(
            f"상자 color={b.get('color')}는 쓸 수 없습니다. 가능한 값: {', '.join(COLOR)}."
        )
    texts = [plain(rows[r]).rstrip() for r in range(b["r0"], b["r1"] + 1)]
    if "find" in b:
        t = texts[0]
        if b["find"] not in t:
            raise SpecError(
                f"상자 find={b['find']!r}가 {b['r0']}행에 없습니다. 그 행 내용: {t!r}"
            )
        k = t.index(b["find"])
        b.setdefault("c0", dwidth(t[:k]))
        if b["r1"] == b["r0"]:
            b.setdefault("c1", dwidth(t[:k]) + dwidth(b["find"]))
    if "c0" not in b:
        b["c0"] = (
            min(dwidth(t) - dwidth(t.lstrip()) for t in texts if t.strip())
            if any(t.strip() for t in texts)
            else 0
        )
    if "c1" not in b:
        b["c1"] = max(dwidth(t) for t in texts)
    return b


def box_html(b, c_off):
    color = COLOR[b.get("color", "green")]
    r0, r1 = b["r0"], b["r1"]
    c0, c1 = b["c0"] - c_off, b["c1"] - c_off
    left = PAD + c0 * CH - 5
    top = PAD + r0 * LH - 2
    w = (c1 - c0) * CH + 10
    h = (r1 - r0 + 1) * LH + 4
    kind = b.get("kind", "outline")
    fill = FILL.get(b["fill"]) if b.get("fill") else None
    out = []
    if kind == "outline":
        style = f"left:{left}px;top:{top}px;width:{w}px;height:{h}px;border:2px solid {color};border-radius:5px;"
        if fill:
            style += f"background:{fill};"
        out.append(f'<div class="box" style="{style}"></div>')
    elif kind == "bar":
        style = f"left:{left}px;top:{top}px;width:{w}px;height:{h}px;border-left:4px solid {color};"
        style += f"background:{fill or FILL[b.get('color', 'green')]};"
        out.append(f'<div class="box" style="{style}"></div>')
    else:
        raise SpecError(f"상자 kind={kind}는 쓸 수 없습니다. 가능한 값: outline, bar.")
    if b.get("label"):
        if "label_row" in b:
            ly = PAD + b["label_row"] * LH + (LH - 22) / 2 + b.get("label_dy", 0)
        else:
            ly = top + 2 + (LH - 22) / 2
        lx = PAD + (b["label_col"] - c_off) * CH if "label_col" in b else left + w + 10
        out.append(
            f'<div class="pill" style="left:{lx}px;top:{ly}px;background:{color};">{html.escape(b["label"])}</div>'
        )
    return "".join(out)


def spec_rows(spec, base):
    if "segments" in spec:
        rows = []
        for seg in spec["segments"]:
            if seg == "blank":
                rows.append("")
            else:
                rows.extend(
                    load(base / seg["src"])[seg["rows"][0] : seg["rows"][1] + 1]
                )
        return rows
    if "src" not in spec or "rows" not in spec:
        raise SpecError(
            f"이미지 {spec.get('name')}에 src와 rows가 없습니다. 둘 다 넣거나 segments를 쓰세요."
        )
    r0, r1 = spec["rows"]
    lines = load(base / spec["src"])
    if r1 >= len(lines):
        raise SpecError(
            f"이미지 {spec['name']}의 rows 끝 {r1}이 캡처 행 수({len(lines)})를 넘습니다. rows 명령으로 번호를 다시 보세요."
        )
    return lines[r0 : r1 + 1]


def make_html(spec, base=Path(".")):
    """spec 한 장을 (HTML 문서, 창 폭, 창 높이)로 만든다."""
    c0, c1 = spec.get("cols", [0, 200])
    rows = spec_rows(spec, base)
    nobg = set(spec.get("nobg_rows", []))
    body_rows = "".join(
        f'<div class="row">{row_html(line, c0, c1, i in nobg) or "&nbsp;"}</div>'
        for i, line in enumerate(rows)
    )
    boxes = "".join(box_html(resolve_box(b, rows), c0) for b in spec.get("boxes", []))
    ncols = min(max((dwidth(plain(line)) for line in rows), default=0), c1 - c0)
    page_w = int(PAD * 2 + ncols * CH + spec.get("extra_w", 380))
    page_h = int(PAD * 2 + len(rows) * LH + 40)
    doc = f"""<!doctype html><meta charset="utf-8"><style>
html,body{{margin:0;background:rgb{BG};}}
.term{{position:relative;padding:{PAD}px;width:{page_w - 2 * PAD}px;min-height:{page_h - 2 * PAD}px;
font-family:'D2Coding','Apple SD Gothic Neo','Menlo',monospace;font-size:{FONT_PX}px;color:{FG};}}
.row{{height:{LH}px;line-height:{LH}px;white-space:pre;}}
.g{{display:inline-block;height:{LH}px;text-align:center;vertical-align:top;overflow:visible;}}
.box{{position:absolute;box-sizing:border-box;pointer-events:none;}}
.pill{{position:absolute;height:22px;line-height:22px;padding:0 9px;border-radius:11px;color:#fff;
font-family:'Pretendard','Apple SD Gothic Neo',sans-serif;font-size:13px;font-weight:600;white-space:nowrap;}}
</style><div class="term">{body_rows}{boxes}</div>"""
    return doc, page_w, page_h


def screenshot(doc, page_w, page_h, out_png, chrome):
    from PIL import Image, ImageChops

    with tempfile.TemporaryDirectory() as tmp:
        html_path = Path(tmp) / "page.html"
        raw = Path(tmp) / "raw.png"
        html_path.write_text(doc, encoding="utf-8")
        subprocess.run(
            [
                chrome,
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--force-device-scale-factor=2",
                f"--window-size={page_w},{page_h}",
                f"--screenshot={raw}",
                html_path.as_uri(),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        im = Image.open(raw).convert("RGB")
    bbox = ImageChops.difference(im, Image.new("RGB", im.size, BG)).getbbox()
    if bbox:
        im = im.crop(
            (
                max(bbox[0] - CROP_MARGIN, 0),
                max(bbox[1] - CROP_MARGIN, 0),
                min(bbox[2] + CROP_MARGIN, im.size[0]),
                min(bbox[3] + CROP_MARGIN, im.size[1]),
            )
        )
    im.save(out_png, optimize=True)
    return im.size


def d2coding_installed():
    for d in FONT_DIRS:
        folder = Path(d).expanduser()
        if folder.is_dir() and any(
            "d2coding" in p.name.lower() for p in folder.iterdir()
        ):
            return True
    return False


def cmd_rows(args):
    for i, line in enumerate(load(args.capture)):
        text = plain(line).rstrip()
        if text:
            print(f"{i:3d}| {text}")


def cmd_build(args):
    chrome = args.chrome or os.environ.get("CHROME_BIN") or DEFAULT_CHROME
    if not Path(chrome).exists():
        sys.exit(
            f"Chrome을 찾지 못했습니다: {chrome}. --chrome 경로나 CHROME_BIN 환경변수를 주세요."
        )
    try:
        import PIL  # noqa: F401
    except ImportError:
        sys.exit(
            "Pillow가 없습니다. uv run --with pillow python3 render_terminal.py build ... 로 실행하세요."
        )
    if not d2coding_installed():
        print(
            "경고: D2Coding 폰트를 찾지 못해 상자 위치가 어긋날 수 있습니다. brew install --cask font-d2coding",
            file=sys.stderr,
        )
    spec_path = Path(args.spec)
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    base = spec_path.parent
    outdir = base / spec["outdir"]
    outdir.mkdir(parents=True, exist_ok=True)
    want = set(args.names)
    for image in spec["images"]:
        if want and image["name"] not in want:
            continue
        doc, page_w, page_h = make_html(image, base)
        out = outdir / f"{image['name']}.png"
        size = screenshot(doc, page_w, page_h, out, chrome)
        print(out, size)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__,
        epilog=SPEC_HELP,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_rows = sub.add_parser("rows", help="캡처의 행 번호와 평문을 출력한다")
    p_rows.add_argument("capture", help="tmux capture-pane -p -e 로 저장한 파일")
    p_rows.set_defaults(func=cmd_rows)
    p_build = sub.add_parser(
        "build",
        help="spec의 이미지를 PNG로 만든다",
        epilog=SPEC_HELP,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p_build.add_argument(
        "spec", help="spec.json. src와 outdir은 이 파일 기준 상대 경로로 읽는다"
    )
    p_build.add_argument("names", nargs="*", help="만들 이미지 이름. 없으면 전부")
    p_build.add_argument(
        "--chrome",
        help="Chrome 실행 파일 경로. 없으면 CHROME_BIN, 그다음 macOS 기본 위치",
    )
    p_build.set_defaults(func=cmd_build)
    args = parser.parse_args(argv)
    try:
        args.func(args)
    except SpecError as exc:
        sys.exit(f"spec 오류: {exc}")


if __name__ == "__main__":
    main()
