#!/usr/bin/env bash
# 배포된 글 주소를 IndexNow로 네이버와 Bing에 알린다. 구글은 IndexNow를 받지 않는다.
#
#   scripts/indexnow.sh <이전 커밋> <새 커밋>   두 커밋 사이에 추가, 수정, 삭제된 글
#   scripts/indexnow.sh --all                     배포된 sitemap의 모든 주소
#
# 배포 워크플로(deploy.yml)가 배포 뒤에 부른다. 키와 응답 코드는 AGENTS.md "IndexNow" 절에 있다.
set -euo pipefail

SITE="https://blog.nomadamas.org"
HOST="blog.nomadamas.org"
KEY="e3ffaa30b4bec129cb2c5a5d564a0421"
ENDPOINTS=(
  "https://searchadvisor.naver.com/indexnow"
  "https://www.bing.com/indexnow"
)

usage() {
  local code="${1:-0}" fd=1
  [ "$code" -eq 0 ] || fd=2
  sed -n '2,5p' "$0" | sed 's/^# \{0,1\}//' >&"$fd"
  exit "$code"
}

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "필요한 명령이 없습니다: $1" >&2; exit 1; }
}

need curl
need jq

# 키 파일이 없거나 내용이 다르면 검색엔진이 소유를 확인하지 못해 403을 돌려준다.
key_file="$(dirname "$0")/../public/${KEY}.txt"
[ "$(cat "$key_file" 2>/dev/null)" = "$KEY" ] || { echo "키 파일이 키와 다릅니다: $key_file" >&2; exit 1; }

urls=()
case "${1:-}" in
  -h|--help) usage ;;
  --all)
    while IFS= read -r u; do urls+=("$u"); done < <(
      curl -fsS "${SITE}/sitemap-0.xml" | grep -o '<loc>[^<]*</loc>' | sed -e 's/<loc>//' -e 's/<\/loc>//'
    )
    ;;
  "") usage 1 ;;
  *)
    [ $# -eq 2 ] || usage 1
    need gh
    # 얕은 체크아웃에서도 되도록 git diff 대신 GitHub 비교 API로 바뀐 파일을 읽는다.
    while IFS= read -r f; do
      slug="$(basename "$f")"
      slug="${slug%.*}"
      urls+=("${SITE}/posts/${slug}/")
    done < <(
      gh api "repos/${GITHUB_REPOSITORY:-NomaDamas/nomadamas.github.io}/compare/$1...$2" \
        --jq '.files[] | select(.filename | test("^src/content/posts/[^/]+\\.mdx?$")) | .filename'
    )
    # 글이 바뀌면 홈과 글 목록도 바뀐다.
    [ ${#urls[@]} -eq 0 ] || urls+=("${SITE}/" "${SITE}/posts/")
    ;;
esac

if [ ${#urls[@]} -eq 0 ]; then
  echo "알릴 주소가 없습니다."
  exit 0
fi

body="$(jq -n --arg host "$HOST" --arg key "$KEY" --arg loc "${SITE}/${KEY}.txt" \
  '{host: $host, key: $key, keyLocation: $loc, urlList: $ARGS.positional}' --args "${urls[@]}")"

printf '%s\n' "${urls[@]}"
failed=0
for endpoint in "${ENDPOINTS[@]}"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$endpoint" \
    -H 'Content-Type: application/json; charset=utf-8' --data "$body")"
  # 200은 받음, 202는 받았고 키 확인을 기다리는 중이다.
  case "$code" in
    200|202) echo "${endpoint} ${code} (${#urls[@]}개)" ;;
    *) echo "${endpoint} ${code}" >&2; failed=1 ;;
  esac
done
exit "$failed"
