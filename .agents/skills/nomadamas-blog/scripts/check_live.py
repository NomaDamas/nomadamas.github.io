#!/usr/bin/env python3
"""발행한 블로그 글을 실제 주소에서 확인한다.

사용:
  check_live.py <slug> [--post <원고.md>] [--expect <문구>]... [--absent <문구>]...
                [--base https://blog.nomadamas.org]

확인하는 것(하나라도 실패하면 종료 코드 1):
  - 글 주소 응답 200과 제목. --post가 있으면 원고 title이 <title>에 들어 있는지
  - 제목 아래 작성자 표시("작성:" 뒤 GitHub 계정 링크)
  - og:image 응답 200
  - 본문(article)의 이미지, 영상, 포스터 응답 200. --post가 있으면 원고와 개수 비교
  - 본문에 취소선(<del>)이 없는지
  - sitemap과 홈(없으면 글 목록)에 글 주소가 있는지
  - --expect 문구가 본문에 있고 --absent 문구가 없는지. 고친 문구와 지운 문구를 넘긴다.
    빌드가 바꾼 둥근 따옴표는 곧은 따옴표로 맞춰 비교하므로 원고의 문구를 그대로 넘기면 된다

읽기만 한다. --base와 같은 호스트의 주소만 조회하고, 다른 호스트 주소는 건너뛰고 알린다.
글 주소에는 조회 시각을 붙여 캐시된 옛 페이지를 받지 않는다.
"""

import argparse
import html
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

# GitHub Pages 첫 응답이 몇 초 걸릴 때가 있어 넉넉히 둔다
TIMEOUT_S = 20
USER_AGENT = "nomadamas-blog-check-live"

FENCE_RE = re.compile(r"^[ \t]*(`{3,}|~{3,})[^\n]*\n.*?^[ \t]*\1[ \t]*$", re.S | re.M)
FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)
# 블로그 빌드는 곧은 따옴표를 둥근 따옴표로 바꾼다. 원고에서 옮긴 문구와 맞추려고 되돌린다
QUOTES = str.maketrans({"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"'})


class Report:
    def __init__(self):
        self.failed = 0

    def ok(self, msg):
        print(f"통과: {msg}")

    def fail(self, msg):
        self.failed += 1
        print(f"실패: {msg}")

    def skip(self, msg):
        print(f"건너뜀: {msg}")


def request(url, method="GET", extra=None):
    """(응답 코드, 헤더, 본문). 연결 실패는 코드 None과 이유."""
    headers = {"User-Agent": USER_AGENT, "Cache-Control": "no-cache"}
    headers.update(extra or {})
    req = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            body = r.read() if method == "GET" else b""
            return r.status, r.headers, body
    except urllib.error.HTTPError as e:
        return e.code, e.headers, b""
    except (urllib.error.URLError, TimeoutError) as e:
        return None, {}, str(getattr(e, "reason", e)).encode()


def media_status(url):
    """미디어는 내려받지 않고 응답 코드만 본다. HEAD를 막는 서버는 첫 바이트만 받는다."""
    code, _, _ = request(url, "HEAD")
    if code in (403, 405, 501):
        code, _, _ = request(url, "GET", {"Range": "bytes=0-0"})
    return code


def text_of(fragment):
    fragment = re.sub(r"<(script|style)\b.*?</\1>", " ", fragment, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def plain(text):
    return text.translate(QUOTES)


def manuscript(path):
    """원고의 title, 이미지 수, 영상 수."""
    text = Path(path).read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    title = ""
    if m:
        t = re.search(r'^title:\s*"?(.*?)"?\s*$', m.group(1), re.M)
        title = t.group(1) if t else ""
    body = FENCE_RE.sub("", text[m.end():] if m else text)
    images = len(re.findall(r"!\[[^\]]*\]\(", body)) + len(re.findall(r"<img\b", body))
    videos = len(re.findall(r"<video\b", body))
    return title, images, videos


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("slug", help="글 slug (https://<base>/posts/<slug>/)")
    parser.add_argument("--post", help="원고 md. 제목과 이미지, 영상 개수를 맞춰 본다")
    parser.add_argument("--expect", action="append", default=[], help="본문에 있어야 할 문구")
    parser.add_argument("--absent", action="append", default=[], help="본문에 없어야 할 문구")
    parser.add_argument("--base", default="https://blog.nomadamas.org", help="블로그 주소")
    args = parser.parse_args(argv)

    base = args.base.rstrip("/")
    host = urlparse(base).netloc
    report = Report()
    path = f"/posts/{args.slug}/"
    page_url = f"{base}{path}?check={int(time.time())}"

    code, _, raw = request(page_url)
    if code != 200:
        report.fail(f"{base}{path} 응답 {code} {raw.decode('utf-8', 'replace')[:80]}")
        return 1
    page = raw.decode("utf-8", "replace")
    title_m = re.search(r"<title>(.*?)</title>", page, re.S)
    title = html.unescape(title_m.group(1)).strip() if title_m else ""
    report.ok(f"{base}{path} 응답 200, 제목 {title!r}")

    md = manuscript(args.post) if args.post else None
    if md and md[0] and md[0] not in title:
        report.fail(f"원고 제목 {md[0]!r}이 페이지 제목에 없습니다")

    author = re.search(r'작성:\s*<a href="(https://github\.com/[^"]+)"[^>]*>([^<]+)</a>', page)
    if author:
        report.ok(f"작성자 표시 {author.group(2).strip()} ({author.group(1)})")
    else:
        report.fail("제목 아래 작성자 표시(작성: GitHub 계정 링크)를 찾지 못했습니다")

    def check_url(label, url):
        """주소 하나의 응답을 보고 'ok', 'fail', 'skip' 중 하나를 돌려준다."""
        url = urljoin(page_url, html.unescape(url))
        if urlparse(url).netloc != host:
            report.skip(f"{label} 다른 호스트라 조회하지 않음: {url}")
            return "skip"
        status = media_status(url)
        if status in (200, 206):
            return "ok"
        report.fail(f"{label} 응답 {status}: {url}")
        return "fail"

    og = re.search(r'<meta property="og:image" content="([^"]+)"', page)
    if not og:
        report.fail("og:image 메타 태그가 없습니다")
    elif check_url("og:image", og.group(1)) == "ok":
        report.ok("og:image 응답 200")

    a0, a1 = page.find("<article"), page.find("</article>")
    if a0 < 0 or a1 < a0:
        report.fail("본문 <article>을 찾지 못했습니다")
        return 1
    article = page[a0:a1]
    imgs = re.findall(r'<img\b[^>]*\bsrc="([^"]+)"', article)
    videos = re.findall(r'<video\b[^>]*\bsrc="([^"]+)"', article)
    posters = re.findall(r'<video\b[^>]*\bposter="([^"]+)"', article)
    results = [check_url("본문 미디어", u) for u in imgs + videos + posters]
    if "fail" not in results:
        report.ok(f"본문 이미지 {len(imgs)}개, 영상 {len(videos)}개, 포스터 {len(posters)}개 응답 200")
    if md:
        if len(imgs) != md[1]:
            report.fail(f"본문 이미지 {len(imgs)}개가 원고의 {md[1]}개와 다릅니다")
        if len(videos) != md[2]:
            report.fail(f"본문 영상 {len(videos)}개가 원고의 {md[2]}개와 다릅니다")

    dels = re.findall(r"<del>(.*?)</del>", article, re.S)
    if dels:
        report.fail(f"본문에 취소선 {len(dels)}곳: {[text_of(d)[:30] for d in dels]}. 원고의 물결표를 확인하세요")

    code, _, raw = request(f"{base}/sitemap-index.xml")
    locs = re.findall(r"<loc>([^<]+)</loc>", raw.decode("utf-8", "replace")) if code == 200 else []
    in_sitemap = any(
        path in request(loc)[2].decode("utf-8", "replace")
        for loc in locs
        if urlparse(loc).netloc == host
    )
    if in_sitemap:
        report.ok("sitemap에 글 주소가 있습니다")
    else:
        report.fail(f"sitemap에서 {path}를 찾지 못했습니다 (sitemap-index 응답 {code})")

    for listing in ("/", "/posts/"):
        code, _, raw = request(f"{base}{listing}")
        if code == 200 and path in raw.decode("utf-8", "replace"):
            report.ok(f"{listing} 목록에 글이 있습니다")
            break
    else:
        report.fail("홈과 글 목록에서 글 주소를 찾지 못했습니다")

    body = plain(text_of(article))
    for phrase in args.expect:
        if plain(phrase) in body:
            report.ok(f"본문에 {phrase!r}가 있습니다")
        else:
            report.fail(f"본문에 {phrase!r}가 없습니다")
    for phrase in args.absent:
        if plain(phrase) in body:
            report.fail(f"본문에 {phrase!r}가 남아 있습니다")
        else:
            report.ok(f"본문에 {phrase!r}가 없습니다")

    print(f"실패 {report.failed}건" if report.failed else "모두 통과")
    return 1 if report.failed else 0


if __name__ == "__main__":
    sys.exit(main())
