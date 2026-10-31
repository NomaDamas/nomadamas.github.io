# nomadamas-blog

NomaDamas 블로그(`https://blog.nomadamas.org`) 글 한 편을 주제 선정부터 발행 확인까지 진행하고, 블로그의 검색 노출을 점검하고 재는 스킬이다. 사람용 설명이고, 에이전트가 따르는 규칙은 `SKILL.md`와 `references/`에 있다.

## 어디서 왔나

같은 흐름을 두 번 거친 세션에서 뽑았다.

- AutoRAG Agent 소개 글: 참고 글 조사, 사용기 초안, 소개형으로 다시 쓰기, 합성 데이터 시연, 캡처 편집, 템플릿 수정, 발행, 발행 뒤 사실 보강, 공유 문구
- k-skill 소개 글: 주제 선정, 격리 폴더에서 실제 Claude Code 세션 캡처, 표지 제작, PR, 윤문과 군더더기 정리, 머지와 실제 페이지 확인

두 세션에서 사용자가 고친 지점(글 유형, 약한 비교, 구형 모델 시연, 조건 없는 단정, 미리보기 위치, 발행일)을 흐름의 확인 단계로 옮겼다. 원고 문장을 고친 교정은 교정 표의 첫 행(C001~C014)으로 넣었다.

검색 노출 점검(`references/search-audit.md`)은 따로 있던 프로젝트 스킬 `nomadamas-search-audit`를 합친 것이다. 같은 블로그를 다루는 스킬이 둘이면 어느 쪽을 열지 매번 골라야 해서 하나로 모았다. 블로그 글이 Google에 하나도 잡히지 않던 원인을 찾은 세션(하위 사이트맵 미등록, 들어오는 링크 없음)에서 막힌 단계 진단과 발행 뒤 색인 요청(`references/seo-geo.md`, `scripts/request_index.py`)을 더했다.

## 참고 글

- Michael Lynch, [Anti-Patterns in Software Blogging](https://refactoringenglish.com/blog/anti-patterns-software-blogging/) (2026-10-07).
    - 독자와 읽을 효용을 빨리 밝히고, 독자의 배경지식에 맞춰 링크나 이전 글 없이도 이해할 수 있게 쓰는 원칙을 반영했다. 목차 단계의 독자 지식 확인은 `SKILL.md`, 도입과 독립적인 읽기 점검은 `references/review.md`가 정본이다.
    - 자연스러운 말투 점검은 `references/review.md`, 모바일 가로 넘침과 글자 가독성 점검은 `references/publish.md`에 반영했다. 기존 가로 넘침 검사는 유지하고 모바일 화면과 대비 확인을 보강했다.
    - 원문은 사람용 출처 링크다. 실행 코드, 자동 조회, 도구 권한이나 외부 전송 경로는 추가하지 않았다.

## 규칙이 사는 곳

| 무엇 | 정본 |
|---|---|
| 글에 대한 결정(문체, 독자, 글 유형, 이야기, 비교, 자료, 링크, 시연과 캡처) | 이 저장소의 플레이북. 결정 교정은 규칙 끝의 id로 교정 표와 이어진다 |
| 사용기형과 사용법형의 절 순서, SEO 점검표(제안) | 이 저장소의 조사 문서 |
| 이야기 뼈대와 검토 점검표(제안) | 이 저장소의 조사 문서 |
| frontmatter, 본문 관례, 작성자 표시 | 이 저장소 `AGENTS.md` |
| 검색 노출 좌표, 권한, 토큰 받는 법 | 이 저장소의 운영 문서 |
| 배포 뒤 IndexNow 알림의 구현과 키 | 블로그 저장소 `AGENTS.md` "IndexNow" |
| 검색 측정 결과와 관측 기록 | 이 저장소의 작업 폴더 |
| 진행 순서, 승인 경계, 검증 방법 | 이 스킬 |
| Studio에서 넘긴 조사 세션과 자료 맥락 | 이 스킬 `SKILL.md`의 handoff 규칙과 `request.md`, `handoff.md`, `task.md` |
| 사용자가 고쳐 준 지점 | 이 스킬 `references/corrections.tsv` |

이 스킬이 들어 있는 블로그 에디터 저장소가 실행 절차와 스킬 파일의 정본이다.

## 교정 표

검수 때 사용자가 고쳐 준 지점을 `references/corrections.tsv`에 한 줄씩 쌓고, 다음 글을 쓸 때와 검수할 때 되돌려 준다.

| 언제 | 명령 | 하는 일 |
|---|---|---|
| 교정을 받았을 때 | `list`, `add`, `hit`, `edit` | 같은 교정이 있는지 찾고, 새 교정을 적거나 같은 교정이면 횟수를 올린다 |
| 결정 교정의 이력을 볼 때 | `brief --type 결정` | 결정 교정의 반복 횟수와 고치기 전후 예시를 모두 보여 준다. 규칙 문장은 플레이북에서 같은 id로 찾는다 |
| 쓰기 전 | `brief` | 반복이 많은 교정을 고치기 전후 문장으로 보여 준다 |
| 검수 | `check`, `review` | 검사 행은 정규식으로 원고에서 찾고, 검토와 결정 행은 독립 검토자의 점검표가 된다 |

같은 교정이 되풀이되면 이 글만에서 검토로, 검토에서 검사로 올리고, 검사로도 막지 못하면 원고를 저장할 때 도는 훅을 제안한다. 문장 모양으로 잡을 수 없는 검토와 결정은 이유를 새 경우까지 넓힌다. 단계별 기준은 `corrections.py --help`에 있다.

목차 단계에서 결정을 다시 읽게 한 이유: jev-ai 글에서 다시 지적받은 교정 3건(C003, C008, C026)이 원고 단계의 `brief` 10건에 모두 빠져 있었고, 그때는 그림 계획이 이미 끝난 뒤였다. 처음에는 목차 단계에서 `brief --type 결정`을 읽게 했는데, 같은 결정이 교정 표와 플레이북에 두 벌로 있어 읽는 양만 늘었다. 그래서 규칙 문장은 플레이북 한 벌로 모으고 규칙 끝에 교정 id를 달아, 목차 단계에서는 플레이북을 다시 읽게 했다. id가 빠지면 `tests/test_corrections.py`의 플레이북 대조 테스트가 실패한다.

## 스크립트

스크립트가 하는 일은 `SKILL.md` 스크립트 절이 정본이다. 여기에는 실행에 필요한 것과 만든 이유만 둔다.

| 스크립트 | 필요한 것 | 메모 |
|---|---|---|
| `render_terminal.py` | Chrome, Pillow, D2Coding 폰트 | `tmux capture-pane -p -e` 출력을 받는다 |
| `render_html.py` | Chrome. 아래 여백을 자를 때 Pillow | 글마다 Chrome 호출을 새로 짜던 렌더 스크립트(2026-10-08 기준 5개 글에 7개)를 대신한다 |
| `check_post_invariants.py` | 표준 라이브러리 | 한 문단의 물결표 두 개는 줄이 달라도 짝이 되어 취소선이 되거나 대체 텍스트에서 지워져서 따로 잡는다 |
| `check_cross_post.py` | 표준 라이브러리 | 문장 단위 윤문 도구는 한 글만 보므로 글끼리 되풀이한 소개 문장을 잡지 못한다 |
| `check_phone_width.py`, `check_playback.py` | Chrome | |
| `check_live.py`, `corrections.py` | 표준 라이브러리 | |
| `recheck_values.py` | `gh` | |
| `request_index.py` | Aside CLI, Search Console 소유자로 로그인된 Aside 계정 | 색인 생성 요청은 API가 없어 화면을 조작한다. Google이 화면을 바꾸면 깨지므로 `--no-submit`으로 먼저 본다 |

테스트(Chrome과 네트워크 없이 돈다. 여백 자르기 테스트는 Pillow가 있을 때만 돈다):

```bash
cd <블로그 에디터 저장소> && python3 -m unittest discover -s .agents/skills/nomadamas-blog/tests
```

네트워크와 프로세스를 쓰는 스크립트의 보안 검토(2026-10-08, 이 스킬에서 직접 작성한 코드):

- `check_live.py`: `--base`(기본 `https://blog.nomadamas.org`)와 같은 호스트에만 GET과 HEAD를 보내고, 다른 호스트의 이미지와 영상은 건너뛴다. 자격증명을 쓰지 않고 파일을 쓰지 않는다. 미디어는 HEAD나 첫 1바이트만 받는다. urllib가 리디렉션을 따라가므로 다른 호스트로 넘어가면 그 응답까지 읽는다.
- `check_phone_width.py`: `dist`를 127.0.0.1의 빈 포트에서 내보내고 headless Chrome을 임시 프로필로 띄운다. Chrome이 127.0.0.1 밖 주소를 찾지 못하게 막아서, 분석 ID를 넣고 빌드한 `dist`라도 방문 기록이 나가지 않는다. 끝나면 그 프로필로 띄운 Chrome만 끝내고 임시 폴더를 지운다. `dist`에는 쓰지 않는다.
- `recheck_values.py`: 사용자 `gh` 인증으로 `gh api` GET을 보내고, 해커뉴스 공개 API(`hacker-news.firebaseio.com`)를 자격증명 없이 읽는다. 파일을 쓰지 않는다. `gh api` 경로는 셸을 거치지 않는 인자 목록으로 넘기고 `repos/`, `orgs/`로 시작해 옵션으로 읽히지 않는다. 해커뉴스 글 번호는 숫자만 받는다.
- `render_html.py`: 주어진 HTML 파일이나 주소를 headless Chrome에 임시 프로필로 띄워 찍고 출력 PNG만 쓴다. 주소를 주면 그 페이지가 부르는 외부 자원도 받는다. 끝나지 않는 Chrome은 프로세스 그룹으로 끝내고, `pkill -f`는 임시 폴더 아래 `profile` 경로일 때만 부른다.
- `check_playback.py`(2026-10-14 검토): `dist`를 127.0.0.1의 빈 포트에서 내보내고, 측정 결과를 같은 로컬 서버로 POST받는다. headless Chrome을 임시 프로필로 띄우고 127.0.0.1 밖 주소를 찾지 못하게 막는다. 끝나면 `pkill -f`로 그 임시 프로필 경로의 Chrome만 끝내고, 임시 폴더 아래일 때만 프로필을 지운다. `dist`에는 쓰지 않는다.
- `check_cross_post.py`(2026-10-14 검토): 주어진 원고와 같은 폴더(또는 `--posts-dir`)의 `*.md`를 읽기만 한다. 네트워크, 프로세스, 파일 쓰기가 없다.
- `request_index.py`(2026-10-27 검토): `aside repl`을 인자 목록으로 띄워 사용자의 로그인된 Aside 계정에서 `search.google.com` Search Console 화면만 연다. 주소마다 탭 하나를 열고 끝나면 닫는다. 화면의 Google 계정이 `--google-account`와 다르면 아무것도 누르지 않고, 주소가 `--property` 범위 밖이면 Aside를 부르기 전에 멈춘다. 값은 JSON 문자열로 넣어 스크립트 문법을 깨지 못한다. 외부로 나가는 쓰기는 색인 생성 요청 버튼 클릭 하나이고 `--no-submit`이면 그것도 없다. 파일을 쓰지 않는다.
- 결정: 승인. 스크립트를 고치면 이 검토를 다시 한다.

## 검색 점검 근거

- https://developers.naver.com/docs/serviceapi/datalab/search/search.md : ratio는 상대값이다.
- https://support.google.com/trends/answer/4365533 : 정규화된 검색 관심도를 절대 검색량으로 바꾸지 않는다.
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide : 일반 색인과 생성형 검색 노출 조건을 구분한다.
- https://developers.naver.com/products/terms/ : 검색 API 특약 2.3이 결과와 파생물의 저장, AI 입력을 금지한다.
- https://api-dashboard.search.brave.com/terms-of-service : 3(b)(i)이 일시 저장 밖의 검색 결과 저장을 금지한다.
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query : Search Console 질의별 실적 API.
- https://cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateAccessToken : 키 파일 없이 서비스 계정 토큰을 받는 API.
- https://www.indexnow.org/searchengines.json : IndexNow 참여 검색엔진 목록. 네이버와 Bing은 있고 Google은 없다(2026-10-27 확인).

## 외부 도구

- patina(`https://github.com/devswha/patina`, MIT): 검수의 AI 티 2차 탐지와 문단 재작성에 쓴다. 설치하지 않고 `bunx patina-cli`로 부르므로 bun의 최소 배포 기간 설정 안에서 가장 최근 버전이 받아진다.
- 보안 검토(8.9.0, 9.1.0): 설치 스크립트가 없다. `--backend claude-cli`면 도구와 MCP를 끈 `claude -p`만 띄우고, 탐지와 재작성 경로에 다른 네트워크 호출이 없다. 기본 백엔드가 OpenAI API라 명령마다 백엔드를 적는다.
- 탐지 게이트로 둔 이유: 사용자가 고친 5곳이 든 문단에서 `humanize-korean`은 3곳, patina 재작성은 1곳을 고쳤고, 둘을 이어 돌려도 3곳이었다. patina 재작성은 의미 보존 점수를 통과하면서도 예시를 좁히거나 높임을 빼는 일이 있었고, 글 한 편을 통째로 넘기면 끝나지 않았다.

## 나중에

NomaDamas 관련 스킬이 여럿 모이면 NomaDamas 플러그인으로 묶는다. 그때는 플러그인 이름이 앞에 붙으므로 스킬 이름에서 `nomadamas-`를 뺀다.
