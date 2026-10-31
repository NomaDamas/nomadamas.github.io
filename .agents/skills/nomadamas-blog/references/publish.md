# 빌드, PR, 발행

## 목차

- 블로그 저장소 준비
- frontmatter와 날짜
- 빌드와 미리보기
- 테마 수정
- PR
- 머지와 발행 확인
- 발행 뒤 수정
- 작업 폴더 정리

frontmatter 필드, 본문 관례, 이미지 위치, 작성자 표시는 블로그 저장소 `AGENTS.md`가 정본이다.

## 블로그 저장소 준비

- `git fetch origin` 뒤 별도 clone이나 `git worktree add`로 `origin/main`에서 `post/<slug>` 브랜치를 만든다. 로컬 기본 체크아웃은 다른 세션이 다른 브랜치로 쓰고 있을 수 있다.
- 블로그 저장소의 브랜치와 worktree 경로에는 `#`을 넣지 않는다. worktree 폴더 이름에 `#`이 들어가면 Vite가 `astro.config.ts`를 읽지 못해 빌드가 멈춘다. 이슈 번호는 브랜치 이름 대신 PR 본문의 `Closes #N`으로 잇는다.
- 의존성은 `pnpm install --frozen-lockfile`로 설치한다.

## frontmatter와 날짜

- `pubDatetime`은 머지 직전에 실제 머지 시각으로 고친다. 원고를 쓴 시각이 남으면 글 목록 순서와 날짜가 실제 발행과 어긋난다. 글 끝 갱신 이력의 날짜도 같이 맞춘다.
    - 고친 커밋을 push하면 PR 검사가 다시 돌아 머지까지 몇 분 걸린다. 지금 시각에 직전 검사 시간(`gh pr checks`)을 더하고, 그 뒤의 첫 5분 단위 시각을 적어 그 시각에 머지한다.
    - 검사가 그 시각을 넘겨 끝나면 시각을 다시 고치지 않고 통과 즉시 머지한다. 고칠 때마다 검사가 다시 돈다.
    - 배포 빌드 시각보다 미래로 적은 글은 블로그 설정(`src/config.ts`)의 `scheduledPostMargin` 안이어야 목록에 나온다.
- `ogImage`에 표지(`00-cover.png`)를 연결한다.
- `featured: true`는 홈 상단 자리를 차지하므로 PR 리뷰 포인트에 적는다.

## 빌드와 미리보기

- `pnpm build`는 타입 검사, 빌드, 검색 색인까지 돈다. 오류와 경고가 0인지 본다.
- `dist/posts/<slug>/index.html`을 직접 읽어 제목, 설명, `og:image`, canonical, 본문 이미지 수, 의도하지 않은 취소선(`<del>`)을 확인한다. curl 결과를 요약하는 도구는 JSON-LD를 지워서 "스키마 없음"으로 잘못 보인다.
- 미리보기는 빈 포트를 확인하고 `dist`를 정적 서버로 띄워 주소를 사용자에게 알린다(`python3 -m http.server <포트> --directory dist`). 응답이 200인지 확인하고 알린다.
- 1280px 폭으로 전체를 찍어 제목 줄바꿈, 목차, 콜아웃, 표, 코드 블록, 이미지를 눈으로 본다.
- 폰 폭은 먼저 `python3 <skill-dir>/scripts/check_phone_width.py dist <slug>`로 가로 넘침을 잰다. 종료 코드가 1이면 넘친 요소가 함께 나온다. 그다음 `chrome-devtools`로 390px 화면을 띄워 눈으로 본다. headless Chrome 창은 약 500px 아래로 줄지 않는다.

    ```bash
    chrome-devtools new_page "http://localhost:<포트>/posts/<slug>/" --background --output-format json
    chrome-devtools emulate <id> --viewport 390x844x3,mobile,touch
    chrome-devtools take_screenshot <id> --filePath <작업 폴더>/preview/390-01.png
    ```

    - `<id>`는 `new_page` 출력의 `pages`에서 이번에 연 주소의 `id`를 쓴다. 다른 페이지는 다른 세션의 탭일 수 있다. 다 보면 `close_page <id>`로 닫는다.
    - 페이지 명령이 `The browser is already running`으로 실패하면 `chrome-devtools-cli` 스킬의 동시 세션 절대로 한다. 데몬과 브라우저 프로필은 다른 세션과 함께 쓴다.
    - 블로그는 부드러운 스크롤(`scroll-smooth`)을 써서 `scrollTo` 직후에는 아직 옮기기 전 위치다. `window.scrollTo({top: <y>, behavior: "instant"})`로 옮겨 찍는다.
    - 본문 이미지는 지연 로딩이라 화면에 들어온 뒤에야 받는다. 훑으며 바로 찍으면 비어 찍히므로, 찍기 전에 모든 `img`의 `loading`을 `"eager"`로 바꾸고 `complete`가 모두 참이 될 때까지 기다린다.
    - `srcset` 이미지의 `naturalWidth`는 `sizes` 폭에 맞춰 환산한 값이라 실제 파일보다 작게 나온다(390px 화면에서 390). 흐린지는 숫자 대신 스크린샷으로 본다.
- 본문에 영상이 있거나 테마의 페이지 이동이나 미디어 코드를 고쳤으면 `python3 <skill-dir>/scripts/check_playback.py dist <slug>`로 홈에서 링크를 눌러 글에 들어갔을 때 영상이 재생되는지 본다. 블로그는 페이지를 옮길 때 본문만 바꿔 끼우므로, 주소를 직접 열어 보는 확인으로는 이동 뒤에만 생기는 문제를 놓친다. 소리가 있는 영상에 `muted`가 남아 있어도 실패로 나온다.
- 브라우저의 모바일 미리보기에서도 본문을 처음부터 끝까지 읽는다. 이미지와 코드 블록 때문에 페이지 전체가 가로로 넘치지 않는지 확인한다. 긴 코드 블록 안에서만 가로로 스크롤하는 것은 본문 전체의 넘침과 구분한다.
- 라이트와 다크 모드에서 본문과 캡션의 글꼴, 크기, 글자와 배경의 대비를 확인한다. 브라우저 접근성 검사 도구로 낮은 대비를 찾고, 문제가 있으면 테마 수정 절의 절차로 고친 뒤 다시 확인한다.
- 부제, 저자 소개, 표지, 인용문도 독자가 도입에 도달하기 전에 읽거나 넘기는 요소로 본다. 제목과 읽을 이유를 불필요하게 밀어내는 요소는 줄인다.
- 하이픈이 든 영어 단어와 긴 인라인 코드는 좁은 폭에서 하이픈 자리에서 끊긴다. 명령은 코드 블록으로 옮기고, 제목은 끊겨도 읽히게 고친다.

## 테마 수정

- 글을 보다가 표, 목차, 날짜 같은 공통 모양을 고치게 되면 테마 공통 파일에서 고친다. 브랜치(`style/<설명>`)와 PR은 글과 나눈다.
- 이 글에서만 동작하는 분기나 하드코딩을 넣지 않는다. 다른 글 하나에서도 같게 보이는지 확인한다.
- 라이트, 다크, 폰 폭에서 각각 확인한다.
- 새로 생긴 본문 관례는 블로그 저장소 `AGENTS.md` 본문 관례 절에 적는다.

## PR

- `git add`는 이번 글의 md 파일과 이미지 폴더만 지정한다.
- PR 본문은 다음 템플릿을 그대로 쓴다.

```markdown
## 무엇을
<글 한 편과 이미지 N장. 대신하는 PR이 있으면 번호>

![커버](https://raw.githubusercontent.com/NomaDamas/nomadamas.github.io/<브랜치>/src/assets/images/<slug>/00-cover.png)

## 왜
- <이 주제를 고른 근거>

## 검증
- `pnpm build` 결과와 눈으로 확인한 화면 폭
- 시연 환경, 캡처 방법, 전역 부작용 점검 결과

<details>
<summary>수치 출처</summary>

- <수치>: <출처>, <조회일>

</details>

## 리뷰 포인트
- <사용자가 정할 것: 외부 이미지 권리, featured, 발행 시각, 실패 장면을 실은 이유>
```

## 머지와 발행 확인

- 머지 전에 이 PR의 머지에 대한 승인을 받는다.
- 머지 직전에 `recheck_values.py <작업 폴더>/recheck.tsv`로 변하는 값을 다시 보고, 바뀐 값은 `review.md` 근거 표 절대로 고친다.
- PR을 연 뒤 `main`이 움직였으면 합친 상태를 로컬에서 한 번 빌드한 뒤 머지한다. 커밋하지 않은 변경이 없는 브랜치에서 `git merge --no-commit --no-ff origin/main`으로 합치고 `pnpm build`를 돌린다. 본문에 영상이 있으면 그 `dist`로 `check_playback.py`도 돌린다. 그다음 `git merge --abort`로 되돌린다. 브랜치에 커밋이 남지 않아 다시 push하지 않아도 된다.
- PR 검사가 통과한 뒤 머지한다(`gh pr checks <번호> --watch`). 검사가 도는 중에 머지하면 실패한 빌드가 그대로 배포될 수 있다.
- `gh pr merge <번호> --merge`로 머지 커밋을 남긴다. 스쿼시하면 브랜치 커밋이 `main`에 남지 않아 정리할 때 머지됐는지 확인할 수 없다.
- 머지 뒤 배포 워크플로가 성공했는지 확인한다(`gh run list`, `gh run watch`).
- 실제 페이지는 아래 스크립트로 확인하고, 통과한 항목만 완료로 보고한다. 응답과 제목, 작성자 표시, `og:image`, 본문 이미지와 영상의 개수와 응답, 취소선, `sitemap`과 홈 목록을 본다.
    ```bash
    python3 <skill-dir>/scripts/check_live.py <slug> --post src/content/posts/<slug>.md
    ```
- 발행을 확인하며 새로 만든 캡처와 로그는 이 저장소의 작업 폴더로 옮겨 커밋할지, 버릴지 정한다. 기록은 같은 저장소의 PR로 남기고, worktree에 미추적으로 남긴 파일은 나중에 쓸모를 아는 세션이 없다.

## 발행 뒤 수정

발행한 글은 독자가 이미 읽고 있어서 고친 곳이 다른 곳을 깨면 바로 드러난다. 새 글과 같은 검증을 아래 순서로 거친다. 체크리스트를 응답에 복사해 진행한다.

1. [ ] 준비: 같은 글을 고치는 열린 PR이나 worktree가 있는지 먼저 본다(`gh pr list --state open`, `git worktree list`). 있으면 겹치는지 사용자에게 알린다. 그다음 이 저장소에서 `git fetch origin` 뒤 `origin/main`에서 새 worktree와 `fix/<slug>-<설명>` 브랜치를 만든다. 지난 글 브랜치 위에서 고치면 그 뒤 다른 세션이 머지한 변경이 빠진다.
2. [ ] 같은 모양: 지적받은 곳과 같은 모양을 글 전체에서 찾아 함께 고친다(`SKILL.md` 사용자 교정 받기 절).
3. [ ] 변하는 값: `recheck_values.py <작업 폴더>/recheck.tsv`를 돌린다. `recheck.tsv`가 없는 지난 글이면 근거 표의 star, 릴리스, PR 상태로 먼저 만든다. 날짜 없이 상태를 말하는 문장이 틀린 말이 됐으면 함께 고친다.
4. [ ] 바뀌면 안 되는 것: 발행본과 비교한다. 새로 넣은 이미지와 `modDatetime`은 경고로, 발행본의 이미지가 사라지면 오류로 나온다. 그림을 새 파일로 바꿨으면 옛 그림이 오류로 나오므로 오류가 바꾼 그림뿐인지 보고 PR 검증 줄에 적는다. 같은 파일 이름에 덮어쓰면 이 검사가 바뀐 그림을 보지 못한다.

    ```bash
    git show origin/main:src/content/posts/<slug>.md > <임시 폴더>/published.md
    python3 <skill-dir>/scripts/check_post_invariants.py --published <임시 폴더>/published.md src/content/posts/<slug>.md
    ```

5. [ ] 검사와 미리보기: `corrections.py check`, `check_cross_post.py`, `pnpm build`, 빌드와 미리보기 절의 폰 폭 확인과 영상 재생 확인. 새 그림이나 바뀐 주장이 있으면 `review.md` 독립 검토에서 그 검토자(이미지, 사실)만 다시 돌린다.
6. [ ] 작업 기록: 바뀐 주장은 근거 표에, 새 그림의 원본과 렌더 명령은 작업 폴더에, 받은 교정은 교정 표에 적어 이 저장소 PR로 올린다.
7. [ ] PR: 아래 템플릿으로 연다. push와 PR 생성은 승인받는다.
8. [ ] 날짜와 갱신 이력: 발행과 다른 날 독자가 읽는 내용(사실, 문장, 그림)을 고치면 `modDatetime`을 머지 시각으로 적는다. 머지 승인을 받은 뒤 머지 직전에 적어 push하고 PR 검사를 다시 기다린다. 홈과 글 목록, RSS가 이 값으로 정렬해 그 글이 맨 위로 올라가므로, 대체 텍스트나 오탈자, 문장 부호처럼 뜻이 그대로인 수정에는 적지 않는다.
    - 갱신 이력에 고친 날짜와 바뀐 것을 한 줄 더한다. 사실을 바로잡았으면 같은 날이어도 적는다. 독자가 고치기 전 내용을 이미 봤을 수 있다. 뜻이 그대로인 수정은 적지 않아도 된다.
9. [ ] 머지: 머지와 발행 확인 절대로 한다.
10. [ ] 실제 페이지: 고친 문구를 `--expect`, 바로잡기 전 문구를 `--absent`로 넘겨 반영됐는지 본다. 본문 이미지와 영상 응답도 함께 본다.

    ```bash
    python3 <skill-dir>/scripts/check_live.py <slug> --post src/content/posts/<slug>.md --expect '<고친 문구>' --absent '<옛 문구>'
    ```

11. [ ] 정리: 아래 작업 폴더 정리 절대로 한다.

발행 뒤 수정 PR 본문은 다음 템플릿을 그대로 쓴다.

```markdown
## 무엇을
<고친 곳과 이유. 처음 발행한 PR 번호>

## 고친 곳
| 위치 | 전 | 후 |
|---|---|---|

## 검증
- 발행본 대비 `check_post_invariants.py --published`: <오류가 0이거나 일부러 바꾼 그림뿐인지, 경고가 일부러 바꾼 것뿐인지>
- `recheck_values.py`: <같음, 다름 수와 다른 값의 처리>
- `pnpm build`, 눈으로 본 화면 폭

## 리뷰 포인트
- <사용자가 정할 것>
```

## 작업 폴더 정리

글 하나에 worktree와 원격 브랜치가 여럿 생긴다(글, 발행 뒤 수정, 작업 기록). 머지된 것은 발행 확인이 끝나면 지운다. 남겨 두면 다음 세션이 머지된 브랜치를 진행 중인 작업으로 읽는다.

1. 이 저장소에서 `git fetch --prune` 뒤 이번 글의 worktree, 로컬 브랜치, 원격 브랜치를 모은다(`git worktree list`, `git branch --merged origin/main`, `git branch -r --merged origin/main`). 다른 세션의 것은 뺀다.
2. 지울 목록을 사용자에게 보이고 한 번에 승인받는다.
3. 지우기 전에 확인한다. 하나라도 걸리면 그것은 남기고 알린다.
    - worktree마다 `git status --short`가 비었다
    - worktree마다 `git status --short --ignored`에 빌드 산출물(`node_modules`, `dist`) 말고 작업 폴더로 옮기지 않은 캡처나 로그가 없다
    - 로컬과 원격 브랜치마다 `git merge-base --is-ancestor <브랜치> origin/main`이 성공한다(커밋이 모두 `main`에 들어갔다)
4. `git worktree remove <경로>`, `git branch -D <브랜치>`, `git push origin --delete <브랜치>` 순서로 지운다. `git branch -d`는 `origin/main`이 아니라 브랜치의 upstream이나 기본 체크아웃의 HEAD와 비교한다. 그래서 원격을 먼저 지운 브랜치는 머지됐어도 거부하고, push만 한 브랜치는 머지 전이어도 지운다. 지워도 되는지는 3번의 조상 확인으로 정한다.
5. 브랜치 이름의 `/`로 생긴 상위 폴더(`~/Dev/.worktrees/<저장소>/fix`)가 비었으면 `rmdir`로 지운다. 다른 worktree가 들어 있으면 `rmdir`이 실패해 그대로 남는다.

### 반려된 원고

원고가 반려되면 그 글 브랜치를 남기지 않는다. 반려된 브랜치는 `main`의 조상이 아니라서 위 3번 확인을 통과하지 못하고, push하지 않았으면 다른 세션에 보이지 않는다.

1. 반려된 원고는 이 저장소 작업 폴더에 `before-v<N>.md`로, 그림은 같은 작업 폴더에 넣어 기록 브랜치에 커밋한다.
2. 글 브랜치의 원고와 그림마다 `git hash-object`로 기록에 같은 내용이 있는지 대조한다.
3. 모두 같으면 위 2번처럼 승인받은 뒤 4번, 5번 순서로 지운다.
