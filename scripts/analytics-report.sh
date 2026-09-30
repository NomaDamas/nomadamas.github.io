#!/usr/bin/env bash
# 블로그 방문 데이터를 유입 경로(UTM)별로 조회한다. 읽기만 하고 아무것도 바꾸지 않는다.
#
#   scripts/analytics-report.sh ga [일수] [캠페인]   GA4, 기본 최근 7일
#   scripts/analytics-report.sh clarity [일수]        Clarity, 기본 최근 1일(최대 3일)
#
# 인증과 권한, 호출 한도는 AGENTS.md "방문 데이터 조회" 절에 있다.
set -euo pipefail

GA_PROPERTY_ID="${GA_PROPERTY_ID:-555475692}"
GA_SERVICE_ACCOUNT="${GA_SERVICE_ACCOUNT:-ga-reader@nomadamas-analytics.iam.gserviceaccount.com}"
GA_SCOPE="https://www.googleapis.com/auth/analytics.readonly"
CLARITY_ENDPOINT="https://www.clarity.ms/export-data/api/v1/project-live-insights"

usage() {
  local code="${1:-0}" fd=1
  [ "$code" -eq 0 ] || fd=2
  sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//' >&"$fd"
  exit "$code"
}

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "필요한 명령이 없습니다: $1" >&2; exit 1; }
}

as_table() {
  column -t -s "$(printf '\t')"
}

# 서비스 계정 토큰을 받을 수 있는 gcloud 로그인 계정을 찾아 토큰을 낸다.
# 키 파일 없이 가장(impersonation)으로 받으므로 권한이 있는 계정이 로그인돼 있어야 한다.
ga_token() {
  local accounts a tok
  if [ -n "${GA_ACCOUNT:-}" ]; then
    accounts="$GA_ACCOUNT"
  else
    accounts=$(gcloud auth list --format='value(account)')
  fi
  for a in $accounts; do
    # 재로그인이 필요한 계정이 비밀번호를 묻고 멈추지 않게 입력을 닫는다
    if tok=$(gcloud auth print-access-token --account="$a" \
      --impersonate-service-account="$GA_SERVICE_ACCOUNT" \
      --scopes="$GA_SCOPE" </dev/null 2>/dev/null) && [ -n "$tok" ]; then
      printf '%s' "$tok"
      return 0
    fi
  done
  echo "서비스 계정 토큰을 받을 수 있는 gcloud 계정이 없습니다. AGENTS.md \"방문 데이터 조회\" 절을 보세요." >&2
  return 1
}

ga_report() {
  local days="${1:-7}" campaign="${2:-}" filter='{}' body tok
  need gcloud; need curl; need jq
  case "$days" in '' | *[!0-9]*) echo "일수는 숫자로 적습니다." >&2; usage 1 ;; esac
  if [ -n "$campaign" ]; then
    filter=$(jq -nc --arg c "$campaign" \
      '{dimensionFilter: {filter: {fieldName: "sessionCampaignName", stringFilter: {value: $c}}}}')
  fi
  body=$(jq -nc --arg start "${days}daysAgo" --argjson f "$filter" '{
    dateRanges: [{startDate: $start, endDate: "today"}],
    dimensions: [{name: "sessionSource"}, {name: "sessionMedium"},
                 {name: "sessionCampaignName"}, {name: "sessionManualAdContent"}],
    metrics: [{name: "sessions"}, {name: "activeUsers"}, {name: "screenPageViews"}],
    orderBys: [{metric: {metricName: "sessions"}, desc: true}]
  } + $f')
  tok=$(ga_token)
  curl -sS -X POST "https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY_ID}:runReport" \
    -H "Authorization: Bearer $tok" -H "Content-Type: application/json" -d "$body" |
    jq -r 'if .error then ("GA 오류 \(.error.code): \(.error.message)\n" | halt_error(1)) else
      (["source", "medium", "campaign", "content", "sessions", "users", "views"] | @tsv),
      (.rows // [] | .[] | [.dimensionValues[].value, .metricValues[].value]
        | map(if . == "" then "-" else . end) | @tsv)
    end' | as_table
}

clarity_report() {
  local days="${1:-1}" url resp code
  need curl; need jq
  case "$days" in 1 | 2 | 3) ;; *) echo "Clarity는 최근 1~3일만 조회할 수 있습니다." >&2; usage 1 ;; esac
  url="${CLARITY_ENDPOINT}?numOfDays=${days}&dimension1=Source&dimension2=Medium&dimension3=Campaign"
  if [ -n "${CLARITY_API_TOKEN:-}" ]; then
    resp=$(curl -sS -w '\n%{http_code}' "$url" -H "Authorization: Bearer $CLARITY_API_TOKEN")
  elif command -v agents-env >/dev/null 2>&1; then
    resp=$(agents-env run CLARITY_API_TOKEN -- \
      curl -sS -w '\n%{http_code}' "$url" -H 'Authorization: Bearer {{CLARITY_API_TOKEN}}')
  else
    echo "CLARITY_API_TOKEN이 없습니다. AGENTS.md \"방문 데이터 조회\" 절을 보세요." >&2
    exit 1
  fi
  code=${resp##*$'\n'}
  resp=${resp%$'\n'*}
  case "$code" in
    200) ;;
    429) echo "Clarity 하루 호출 한도(10회)를 넘었습니다. 내일 다시 조회하세요." >&2; exit 1 ;;
    *) echo "Clarity 오류 HTTP $code: $resp" >&2; exit 1 ;;
  esac
  printf '%s' "$resp" | jq -r '
    def v(k): (.[k] // "") | tostring | if . == "" then "-" else . end;
    (["source", "medium", "campaign", "sessions", "bot_sessions"] | @tsv),
    (.[] | select(.metricName == "Traffic") | .information[]
      | [v("Source"), v("Medium"), v("Campaign"),
         v("totalSessionCount"), v("totalBotSessionCount")] | @tsv)
  ' | as_table
}

case "${1:-}" in
  ga) shift; ga_report "$@" ;;
  clarity) shift; clarity_report "$@" ;;
  -h | --help) usage 0 ;;
  *) usage 1 ;;
esac
