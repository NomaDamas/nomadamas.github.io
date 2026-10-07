# NomaDamas 블로그

NomaDamas 조직 블로그의 정본이다. 글과 이미지가 전부 이 저장소에 있고, `main`에 push하면
GitHub Actions가 빌드해 GitHub Pages로 배포한다. 주소는 `https://blog.nomadamas.org`이고
기본 주소 `nomadamas.github.io`는 그쪽으로 넘어간다.

저장소 이름은 `nomadamas.github.io`로 둔다. `<org>.github.io`는 org 루트 사이트라 경로 접두사가
붙지 않는다. 이름을 바꾸면 기본 주소가 바뀌고 색인이 초기화되므로 바꾸지 않는다. 주소를 바꾸는
일은 저장소 이름이 아니라 커스텀 도메인 설정으로 한다("커스텀 도메인" 절).

velog `@nomadamas`와 dev.to는 재게시 채널이다. 정본이 아니다.
선정 근거는 우산 저장소의 `09-docs/blog-platform-260922.html`과 `09-docs/blog-images-seo-260922.html`에 있다.

테마는 [AstroPaper](https://github.com/satnaing/astro-paper)다. 검색(pagefind), 태그,
페이지네이션, 글별 OG 이미지 자동 생성, 라이트/다크가 이미 들어 있다. 업스트림을 고칠 때는
`astro-paper.config.ts`를 먼저 보고, 컴포넌트를 직접 고치면 나중에 업데이트가 어려워진다.

## 발행

```bash
# 글을 브랜치에 올리고 PR을 연다. PR마다 배포와 같은 빌드가 돌고(check.yml), 합치면 배포된다(deploy.yml).
git switch -c post/<슬러그>
git add src/content/posts/<슬러그>.md src/assets/images/<슬러그>/
git commit -m "post: <제목>"
git push -u origin post/<슬러그>
gh pr create
```

합치기 전에 PR의 검사(Check)가 통과했는지 본다. 빌드는 프런트매터 형식 오류, 없는 이미지 경로,
아래 "빌드가 막는 것", 작성자 조회 실패에서 멈춘다. 합친 뒤 배포 빌드가 멈추면 사이트는 이전 배포에
머물고 새 글만 올라가지 않는다.

frontmatter는 AstroPaper 스키마를 따른다. `pubDate`가 아니라 `pubDatetime`이다.

```yaml
---
title: "제목"
description: "검색 결과와 공유 카드에 나오는 한두 문장"
pubDatetime: 2026-09-23T18:00:00+09:00
tags: ["astro", "seo"]
featured: false   # 홈 상단에 올릴 때만 true
draft: false      # true면 빌드에서 빠진다
---
```

`modDatetime`을 발행 뒤 다른 날짜로 적으면 날짜 옆에 수정일이 함께 나온다. 같은 날 고친 것은 표시하지 않는다.

`pubDatetime`은 발행하는 시각을 시간대(`+09:00`)까지 적고, 합치기 직전에 합치는 시각으로 고친다.

- **시간대를 빼면 UTC로 읽힌다.** 한국 시각으로 9시간 늦게 발행된다
- **예약 발행은 없다.** 빌드 시각보다 15분 넘게 미래인 글은 빌드에서 빠지는데(`src/utils/postFilter.ts`),
  정해진 시각에 다시 빌드하는 장치가 없어서 그 시각이 지나도 다음 배포 전까지 보이지 않는다

둘 다 빌드가 막는다(아래 "빌드가 막는 것").

### 본문 관례

글마다 켤 필요 없이 붙는 것은 하나다. 절(h2)과 소절(h3)을 합쳐 3개 이상이면 마우스가 있는 1024px 이상
화면 오른쪽에 떠 있는 목차가 붙는다. 글 전체의 절과 소절이 들어가고, 기준값은 `src/utils/toc.ts`에 있다.

나머지는 본문에 적어야 붙는다.

- **목차 상자**: 요약 뒤, 첫 절 앞에 `## 목차` 한 줄을 두고 바로 다음에 `##` 절을 쓴다. remark-toc가 그 뒤의 절과 소절로
  목록을 채우고 `src/utils/remarkTocBox.ts`가 늘 펼친 상자로 감싼다. 떠 있는 목차가 보이는 화면에서는 상자가 숨는다
    - `## 목차`부터 다음 `##` 제목 전까지는 전부 목록으로 바뀌며 지워진다. 그 사이에 쓴 문장은 물론
      `###` 소절과 그 본문도 사라지므로 빌드가 막는다
    - `## 목차`보다 앞에 있는 제목은 상자에 들어가지 않는다. 떠 있는 목차에는 들어간다
    - 테마 기본의 접는 목차(remark-collapse)는 뺐다. `## Table of contents`, `## Contents`도 같은 상자가 된다
- **접는 내용**(자주 묻는 질문, 개발자용 예시): rehype-callouts 문법으로 `> [!faq]- 질문`처럼 종류 뒤에 `-`를 붙인다.
  `+`를 붙이면 펼친 채로 시작한다. 접는 방식은 이것 하나로 통일한다. raw `<details>`를 쓰면 테마
  `typography.css`의 `details:not(.callout)` 규칙이 안의 문단을 숨긴다(remark-collapse 목차용으로 남은 업스트림 규칙이다).
  그래서 빌드가 막는다
- **강조 상자**: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`
- **줄바꿈되는 코드 블록**: 독자가 복사해 쓰는 긴 문장은 ```` ```text wrap ````처럼 코드 블록 메타에 `wrap`을 적는다.
  나머지 코드 블록은 가로 스크롤이다. 줄바꿈이 뜻을 바꿀 수 있어서다

### 빌드가 막는 것

아래는 빌드가 통과하는데 발행된 글이 조용히 깨지는 경우다. `src/utils/checkPosts.ts`가 빌드 시작 전에
초안을 뺀 모든 글을 보고, 하나라도 걸리면 파일과 줄을 알려 주며 빌드를 멈춘다.
로컬 `pnpm build`, PR 검사, 배포 빌드가 모두 거친다.

- `## 목차` 뒤에 지워질 내용(목차 판정은 remark-toc와 같은 `src/utils/toc.ts` 규칙을 쓴다)
- raw `<details>`
- `/`로 시작하는 이미지 주소(`public/` 이미지). 이유는 "이미지" 절
- GIF 참조와 `src/assets/`, `public/` 아래의 GIF 파일
- 시간대가 없는 `pubDatetime`, `modDatetime`과 빌드 시각보다 미래인 `pubDatetime`

코드 블록과 인라인 코드 안은 예시로 보고 검사하지 않는다.

## 웹에서 글쓰기

`app.pagescms.org`에 GitHub으로 로그인하면 브라우저에서 글을 쓰고 이미지를 드래그해 올릴 수 있다.
저장하면 이 저장소에 바로 커밋되고 Actions가 배포한다. 설정은 `.pages.yml`에 있다.

처음 한 번은 org에 Pages CMS GitHub App을 설치해야 한다. 설치 범위는 이 저장소만 고른다.

**아직 UI에서 검증하지 않았다.** 확인할 것은 하나다. 이미지를 드래그했을 때 본문에
`../../assets/posts/파일명` 형태의 상대경로가 들어가는지. 절대경로가 들어가면 Astro가
최적화하지 않아 원본이 그대로 나가므로, 그때는 `.pages.yml`의 `media.output`을 조정한다.

본문 필드가 rich-text라서 콜아웃(`> [!faq]-`)과 코드 블록 메타(`text wrap`)가 저장 후에도 남는지도 확인하지 않았다.
확인 전에는 이런 문법이 든 글을 웹 편집기로 고치지 않는다.

에이전트가 push하는 경로와 충돌하지 않는다. 둘 다 같은 저장소 파일을 고칠 뿐이다.
다만 같은 글을 동시에 건드리지 않는다.

웹 편집기는 PR 없이 `main`에 바로 커밋하므로 PR 검사를 거치지 않는다. "빌드가 막는 것"에 걸리면
배포 빌드가 멈추고 사이트는 이전 배포에 머문다. 저장한 뒤 Actions 탭에서 배포가 성공했는지 본다.

## 작성자 표시

글 제목 아래 "작성"은 그 글 파일을 처음 추가한 커밋, "최근 수정"은 가장 최근 커밋을 한 GitHub 계정이다.
이름은 GitHub 프로필 이름이고 비어 있으면 아이디다. 고친 적이 없으면 "작성"만 나온다.
빌드할 때 `src/utils/postAuthors.ts`가 GitHub API로 가져온다. 이름과 계정을 짝지은 표를 저장소에 두지 않는다.
사람이 채워야 하는 표는 새 글쓴이가 생길 때마다 비어서 자동 발행과 맞지 않는다.

- **작성자는 처음 추가한 커밋으로 고정된다.** git 기록은 바뀌지 않으므로 다른 사람이 고쳐도 "최근 수정"만 바뀐다.
  파일 이름을 바꿔도 이전 이름의 기록을 따라가 처음 추가한 커밋을 찾는다. GitHub API의 경로 필터는 이름 변경을
  따라가지 않아서, 그대로 두면 이름을 바꾼 사람이 작성자가 된다.
  단 이름을 바꾸는 커밋에서 내용까지 크게 고치면 git이 이름 변경이 아니라 새 파일로 보므로
  그 커밋을 한 사람이 작성자가 된다. 이름 변경과 내용 수정은 커밋을 나눈다
- **대신 올리는 글은 커밋의 author를 실제로 쓴 사람으로 적는다.** git은 쓴 사람(author)과 올린 사람(committer)을
  따로 기록한다. `git commit --author="이름 <이메일>"`로 올리면 그 사람이 작성자로 고정된다. 이메일은 그 사람의
  GitHub 계정에 등록된 주소여야 계정이 잡힌다. 확실한 것은 `<id>+<아이디>@users.noreply.github.com`이고,
  id는 `gh api users/<아이디> --jq .id`로 본다.
  자동 발행(Actions, 클라우드 세션)도 같다. 봇 계정이 커밋하고 PR까지 열면 작성자가 봇으로 나오므로
  커밋 author를 사람으로 적고, 첫 글에서 작성자 줄을 확인한다
- **"최근 수정"은 그 파일을 건드린 마지막 커밋이다.** 여러 글을 한꺼번에 고치는 커밋(경로 일괄 변경,
  서식 정리)은 그 글들의 "최근 수정"을 모두 그 커밋을 한 사람으로 바꾼다. 글 내용과 무관한 일괄 수정은 꼭 필요할 때만 한다
- **글쓴이 표기는 전부 이 작성자 하나에서 나온다.** 구조화 데이터의 author, `<meta name="author">`,
  자동 생성 OG 이미지의 "by" 줄이다. 봇이 처음 올린 글과 GitHub 기록을 못 받은 로컬 빌드만
  프런트매터 `author`(기본값 조직)로 돌아간다
- **커밋 이메일이 GitHub 계정에 없으면 PR을 연 계정으로 대신한다.** GitHub은 계정에 등록된 이메일로만
  커밋을 계정에 잇는다. 로컬 git 이메일이 계정에 없으면 커밋의 author가 비어 오므로 그 커밋이 들어온 PR을 본다.
  PR 없이 `main`에 바로 올린 커밋이면 커밋에 적힌 이름만 링크 없이 나온다.
  봇(Pages CMS, Actions) 커밋도 PR을 먼저 보고, PR을 연 쪽도 봇이면 봇 계정이 나온다
- **배포 빌드는 GitHub 요청이 실패하면 멈춘다.** `deploy.yml`과 `check.yml`이 빌드에 `GITHUB_TOKEN`을 넘기고
  빌드 잡에 `pull-requests: read`를 준다. 일시 오류(5xx, 10초 시간 초과, 1분 이하의 `retry-after`)는
  2초, 5초 뒤에 두 번까지 다시 요청하고, 그래도 실패하면 멈춘다. 로컬 빌드는 다시 요청하지 않고 이 줄만 빼고 통과한다.
  토큰 없는 요청은 시간당 60회라 글이 많으면 로컬에서 줄이 빠진다. 제대로 보려면 `GITHUB_TOKEN=$(gh auth token) pnpm build`
- **GitHub에 올라간 기록만 반영된다.** push하지 않은 글과 커밋은 빠진다. 로컬 빌드는 기본 브랜치의 기록을 쓴다
- **Pages CMS는 로그인한 사람 명의로 커밋한다.** `.pages.yml`의 `settings.commit.identity: user`.
  기본값(`app`)이면 웹에서 쓴 글이 봇 명의로 커밋되어 작성자가 봇으로 나온다

## 이미지

- **이미지는 `src/assets/images/`에 둔다.** 글에서 `@/` 별칭으로 참조한다:
  `![설명](@/assets/images/foo.png)`. 별칭이라 글이 어느 깊이에 있든 경로가 같다.
- **원본을 그대로 커밋한다.** 빌드할 때 Astro가 webp로 변환하고 srcset을 만든다.
  실측(2026-09-23)으로 2,000px PNG 2,394KB가 webp 5장(15.6~95.1KB, 합계 274KB)이 된다.
  독자는 화면에 맞는 1장만 받는다. 커밋 전에 손으로 줄이지 않는다.
- **`public/`에 이미지를 넣지 않는다.** Astro가 `public/`은 처리하지 않아 원본이 그대로 나간다.
  위 실측 기준 발행 용량이 약 9배 갈린다. 예외는 Astro가 다루지 않는 동영상뿐이다.
- **GIF를 커밋하지 않는다.** 실측 2,976KB GIF가 mp4로 377KB다. 움짤은 mp4로 만들어 `public/videos/`에 둔다.
  개별 파일 100MiB를 넘으면 push 자체가 거부된다.
- **Git LFS를 쓰지 않는다.** 공식 문서에 `Git LFS cannot be used with GitHub Pages sites`이고,
  평균 150KB 이미지에는 불필요한 복잡도다.

## 건드리기 전에 알아야 할 설정

`astro.config.ts`의 네 항목은 빼면 조용히 망가진다. 빌드는 그대로 통과한다.

| 항목 | 빼면 |
|---|---|
| `site` 절대 URL | 네이버가 sitemap을 수집하지 않는다 |
| `image.layout: 'constrained'` | srcset이 한 장도 안 생긴다. 원본 해상도 1장만 내려간다 |
| `image.breakpoints` | 기본 목록(로컬 8단계) 중 원본 폭 이하마다 파일이 생긴다. 2,000px 1장이 7개가 된다 |
| `fonts`의 Nanum Gothic Coding | OG 이미지의 한글이 전부 두부(□)로 나온다 |

OG 이미지는 satori가 빌드 때 그리는데, satori는 넘겨준 폰트에 없는 글리프를 그냥 비운다.
테마 기본 폰트(Google Sans Code)에는 한글이 없어서 한글 제목이 통째로 사라진다.
`src/utils/loadOgFonts.ts`가 라틴 + 한글 폰트를 한 배열로 묶어 두 OG 생성기에 넘긴다.
**OG 이미지를 건드렸으면 `pnpm build` 후 `dist/og.png`와 `dist/posts/<슬러그>/index.png`를 눈으로 연다.**
글자가 깨져도 빌드는 성공하므로 파일을 직접 보는 것 말고 확인할 방법이 없다.

`@layer base` 안의 스타일은 **레이어 없는 외부 CSS에 항상 진다** -- 특이도와 무관하다.
검색 하이라이트를 팔레트 색으로 맞출 때 이걸로 두 번 헛짚었다. pagefind가 자기 CSS에서
`.pagefind-ui--reset mark { all: revert }`로 되돌리는데, 이걸 이기려면 (1) 규칙을 레이어 밖에 두고
(2) 특이도를 클래스 하나 이상으로 올려야 한다. `global.css` 맨 아래 `mark` 규칙이 그 예다.

`public/robots.txt`는 정적 파일로 둔다. 동적 라우트가 5xx를 내면 네이버가 사이트 전체를 수집 금지로 읽는다.

`/llms.txt`는 `src/pages/llms.txt.ts`가 글 목록에서 빌드 때 만든다. 손으로 고치지 않는다.
구글 검색은 이 파일을 쓰지 않는다(Search Central 2026-06-15 개정: 두어도 순위에 득실 없음).
넣은 이유는 요청이 있는 사이트에서는 AI 봇 요청이 실제로 찍히고(Ahrefs 2026-06 조사, 1위 GPTBot)
Chrome Lighthouse의 실험 항목이 검사하며, 생성 비용이 0이기 때문이다. 구글 Mueller도 2026-05에
"검색용이 아니고 개발자 문서 외에는 별 의미 없다"고 했다. 순위 효과를 기대하고 키우지 않는다.

## 검색 노출 설정

`coreyhaines31/marketingskills`의 `seo-audit`, `ai-seo`, `schema` 스킬 점검표를 기준으로 맞췄다(2026-09-23).
점검은 `pnpm build` 후 `dist/`의 HTML을 직접 읽어서 한다. JSON-LD는 `curl`이나 웹 요약 도구가 지워 버려서
"스키마 없음"으로 잘못 나온다.

- **페이지마다 제목과 설명이 달라야 한다.** 새 페이지를 만들면 `<Layout>`에 `title`과 `description`을 넘긴다.
  빼면 사이트 설명이 그대로 들어가 여러 페이지가 같은 설명을 쓰게 된다. 목록의 2쪽 이후는 제목과 설명에 쪽수가 붙는다.
- **색인이 필요 없는 페이지는 `noindex`.** 지금은 검색(`/search/`)과 404다. `astro.config.ts`의 sitemap `filter`에서도 뺀다.
- **구조화 데이터는 `src/utils/structuredData.ts`가 만든다.** 홈은 `Organization`과 `WebSite`, 글은 `BlogPosting`이다.
  글의 author는 제목 아래 보이는 작성자(`Person`, GitHub 프로필 주소 포함)이고 publisher는 조직(NomaDamas)이다.
  화면에 보이는 값만 마크업한다는 원칙에 따라 화면의 "작성"과 같은 사람을 쓴다. 규칙은 "작성자 표시" 절에 있다.
  로고는 `public/apple-touch-icon.png`(180px)를 쓴다. 구글 로고 요건이 112px 이상이라 줄이지 않는다.
- **sitemap `lastmod`는 날짜를 아는 페이지에만 단다.** `src/utils/postLastmod.ts`가 글 프런트매터의 날짜를 읽는다.
  빌드 시각을 넣으면 매 배포마다 전부 바뀐 것처럼 보여 구글이 lastmod를 믿지 않게 된다.
- **`robots.txt`는 크롤러를 이름으로 적는다.** `*`만으로도 전부 허용되지만 AI 크롤러 정책을 추측하게 두지 않으려는 것이다.
  막을 봇이 생기면 그 이름을 빼서 `Disallow` 그룹을 따로 만든다.
- `/llms.txt`는 목차, `/llms-full.txt`는 소개와 모든 글 본문을 한 파일로 묶은 것이다. 둘 다 빌드 때 만들어진다.

## 색과 로고

팔레트는 로고에서 뽑았다. 로고는 #fefefe 종이 위에 #000000 잉크로 그린 낙타와 별이고
중간색이 없다. 그래서 라이트는 종이(#fcfcfc), 다크는 잉크(#111111)를 그대로 배경으로 쓴다.
테마 기본값이던 남색 + 주황은 로고와 무관해서 다크모드에서 로고가 검은 사각형으로 떴다.

강조색은 별에서 가져온 호박색 하나뿐이다. 로고에 색이 없으므로 강조색을 늘리면 마크와 싸운다.
값을 바꾸면 `src/styles/theme.css` 주석의 기준대로 WCAG AA(본문 4.5:1)를 다시 재고 넣는다.

`src/assets/images/logo.png`는 **배경이 투명해야 한다.** 불투명 흰 배경이면 다크모드의
`dark:invert`가 흰 배경까지 검게 뒤집어 사각형 얼룩이 된다. 로고를 교체할 때는 흰 바탕을
알파로 빼고 잉크 주변 여백을 잘라낸 뒤 넣는다.

반대로 `public/favicon-32.png`와 `public/apple-touch-icon.png`는 **흰 배경을 깔아둔다.**
투명하게 두면 다크 탭 막대에서 검은 낙타가 안 보이고, iOS는 투명 영역을 검게 칠한다.

## URL 구조

`/posts/<슬러그>/`로 고정한다. 슬러그는 파일명이 그대로 된다. GitHub Pages는 경로별
서버사이드 301을 만들 수 없고 Astro의 redirects는 meta refresh HTML만 뱉는다.
한번 발행한 주소는 되돌리기 어려우니 파일명을 나중에 바꾸지 않는다. 영문 슬러그를 권한다.

## 언어

UI 문자열은 `src/i18n/lang/ko.ts`에 있다. `astro.config.ts`의 `i18n.locales`에 `ko`가
들어 있어야 `astro-paper.config.ts`의 `lang: "ko"`가 동작한다. 둘 중 하나만 바꾸면 빌드가 깨진다.

검색은 pagefind를 쓰는데 한국어 어간 분석을 지원하지 않는다. 정확히 일치하는 단어는 찾지만
활용형은 못 찾는다. 빌드 로그에 매번 경고가 찍히는데 정상이다.

## 하지 않는 것

- **재게시할 때 canonical을 빼지 않는다.** 없으면 도메인 권위가 높은 velog가 대표로 잡혀
  정본을 자체 도메인에 둔 결정이 무의미해진다.
- **로컬 맥에 자동화를 걸지 않는다.** 발행 자동화는 GitHub Actions나 클라우드 세션의 push로만 한다.

## 검색엔진과 방문 분석

GA4, Microsoft Clarity, Search Console, 네이버 서치어드바이저, Bing 연결은
`scripts/setup-seo-services.sh`로 한다. 사람이 할 일(계정에서 만들기, 값 복사, 확인 버튼)을
단계별로 안내하고, 형식 검사, 저장소 변수 등록, 재배포, 배포된 HTML 확인은 스크립트가 한다.
값을 바꾸거나 서비스를 추가할 때도 이 스크립트를 다시 돌린다. 입력값은 `.seo-services.env`(gitignore)에 남는다.

- **값은 저장소 변수(`vars.*`)에 둔다.** 전부 페이지 HTML에 그대로 나가는 공개값이라 secrets가 아니다.
  `deploy.yml`이 빌드 env로 넘기고 `src/components/SiteAnalytics.astro`가 태그를 만든다.
- **로컬 `.env`에 넣지 않는다.** 넣으면 `pnpm dev` 트래픽이 GA와 Clarity에 섞인다.
- **형식이 틀린 값은 빌드를 멈춘다.** `SiteAnalytics.astro`의 정규식 검사다. 틀린 태그가 조용히
  배포되면 소유확인과 수집이 실패한 걸 몇 주 뒤 빈 리포트로 알게 된다.
- **GA4의 '브라우저 기록 이벤트 기반 페이지 변경'은 꺼 둔다.** ClientRouter가 pushState 순간에만
  이전 글 제목을 넣어 두기 때문에(`astro/dist/transitions/router.js`의 `moveToLocation`), 페이지 전환
  페이지뷰는 `GoogleAnalytics.astro`가 `astro:after-swap`에서 새 제목으로 직접 보낸다. 켜 두면 두 번 잡힌다.
- **`/privacy/`는 켜진 도구만 적는다.** GA4 약관은 사용 사실과 쿠키를, Clarity 약관은 Microsoft 같은
  제3자의 수집, Microsoft Advertising을 위한 수집, 거부 방법, Microsoft 개인정보처리방침 링크를 알리도록 요구한다.
  분석 도구, GA 향상된 측정, 보관 기간, 쿠키, 브라우저 저장 값 가운데 하나라도 바뀌면 `src/pages/privacy.astro`의
  문구와 `updated`를 함께 고친다. Clarity 쿠키 문서에는 만료 기간이 없어서, 본문의 만료 기간은
  2026-10-07에 실제 브라우저로 잰 값이다.
- Bing은 Search Console에서 가져오기로 연결한다. 토큰 없이 확인되고 사이트맵도 따라온다.

### 방문 데이터 조회

`scripts/analytics-report.sh`로 GA4와 Clarity 데이터를 유입 경로(UTM)별로 본다. 읽기만 한다.

```bash
scripts/analytics-report.sh ga 7              # GA4 최근 7일
scripts/analytics-report.sh ga 7 <캠페인>     # utm_campaign 하나만
scripts/analytics-report.sh clarity 1         # Clarity 최근 1일
```

- **GA4는 키 파일 없이 서비스 계정을 가장해 읽는다.** GCP 프로젝트 `nomadamas-analytics`의 서비스 계정
  `ga-reader`가 GA4 속성(`555475692`)에 뷰어로 들어가 있다. 이 서비스 계정의 토큰을 받을 권한
  (`roles/iam.serviceAccountTokenCreator`)은 조직 공용 Google 계정에만 있다. 스크립트는 `gcloud auth list`에서
  이 권한이 있는 계정을 찾아 쓰고, 없으면 그 계정으로 `gcloud auth login`부터 한다.
- **Clarity는 `CLARITY_API_TOKEN`으로 읽는다.** 환경변수가 없으면 `agents-env` 전역 스토어에서 꺼낸다.
  토큰은 Clarity 프로젝트 설정의 Data Export에서 발급한다.
- **Clarity는 하루 10회, 최근 1~3일만 조회된다.** 7일 이상의 추이는 GA4로 본다.
  Clarity의 `sessions`는 봇을 뺀 수이고, `bot_sessions`만 있는 경로는 사람 방문이 아니다.
- **GA4 표준 보고서는 반영이 늦다.** 방문 뒤 하루에서 이틀까지 걸려, 공유 직후 몇 시간은 Clarity에만 잡힐 수 있다.
- **권한을 끊을 때**는 GA4 관리의 속성 액세스 관리에서 서비스 계정을 빼고, Clarity 설정에서 토큰을 지운다.

## 커스텀 도메인 `blog.nomadamas.org`

2026-10-01에 `nomadamas.github.io`에서 옮겼다. 주소를 바꿀 때는 아래 순서를 지킨다.
**DNS가 먼저다.** 반대로 하면 안 뜨는 주소로 넘어간다. GitHub Pages는 org 사이트에 커스텀
도메인이 걸리면 `<org>.github.io` 요청을 그쪽으로 보낸다.

1. Cloudflare(`nomadamas.org` zone)에 `blog` CNAME -> `nomadamas.github.io`를 만든다.
   **반드시 회색 구름(DNS only).** 프록시(주황 구름)를 켜면 GitHub Pages가 Let's Encrypt
   인증서를 못 받고, 크롤러 개방 상태도 덮인다. k-skill이 쓰는 `k-skill.nomadamas.org`와 같은 zone이다.
2. `dig +short blog.nomadamas.org CNAME`이 `nomadamas.github.io.`인지 본다.
3. 저장소 Settings > Pages > Custom domain에 `blog.nomadamas.org`를 넣고 Enforce HTTPS를 켠다.
   Actions로 배포하므로 `CNAME` 파일은 만들지 않고, 만들어도 무시된다. 인증서 발급은 최대 한 시간 걸린다.
   상태는 `gh api repos/NomaDamas/nomadamas.github.io/pages --jq .https_certificate`로 본다(`approved`가 되면 붙은 것이다).
   **커스텀 도메인을 새로 넣으면 Enforce HTTPS가 꺼진 상태로 돌아간다.** 인증서가 `approved`가 된 뒤에 다시 켠다.
4. 도메인을 쓰는 곳을 바꾼다. `astro-paper.config.ts`의 `site.url` 하나가 canonical, sitemap,
   OG 이미지, RSS, `/llms.txt`의 기준이 된다(`astro.config.ts`는 이 값을 그대로 쓴다).
   `public/robots.txt`의 Sitemap 줄과 `scripts/setup-seo-services.sh`의 `SITE_URL`도 같이 바꾼다.
   안 바꾸면 canonical이 옛 주소를 가리킨다.
5. `curl -sI https://blog.nomadamas.org`에 `server: GitHub.com`이 오는지(프록시 안 탔는지)와
   `curl -sIL https://nomadamas.github.io/`가 최종 200인지 본다. 루트는 인증서가 붙기 전에 만들어진
   리다이렉트라 `http://blog.nomadamas.org/`를 한 번 거쳐 올라간다(깊은 경로는 곧바로 https).
6. Search Console과 네이버 서치어드바이저에 새 주소를 추가하고 사이트맵을 다시 제출한다.
   옛 주소 속성은 리다이렉트가 잡히는지 보려고 남겨 둔다. 글 주소(`/posts/...`)는 그대로라
   페이지 색인은 넘어오지만, 옮긴 직후 며칠은 새 주소 노출이 줄어든다.
7. org Settings > Pages > Verified domains에서 `nomadamas.org`를 확인한다. TXT 레코드 하나를
   Cloudflare에 넣는 일이다(`_github-pages-challenge-nomadamas.nomadamas.org`). 확인하지 않으면
   다른 사람이 `blog.nomadamas.org`를 자기 Pages 도메인으로 등록해 우리 서브도메인에 자기 사이트를
   띄울 수 있다. **TXT 레코드는 지우지 않는다.** 지우면 확인이 풀리고, "모르는 TXT"를 정리하다가
   이 레코드를 지우는 일이 없도록 남겨 둔 이유를 여기 적어 둔다.

글 본문에 남은 `https://nomadamas.github.io/...` 링크는 그대로 둔다. 옛 주소가 새 주소로 넘어가므로
깨지지 않고, 여러 글을 한꺼번에 고치면 그 글들의 "최근 수정"이 전부 바뀐다.

조직 사이트에 커스텀 도메인을 걸면 같은 계정의 프로젝트 사이트도 그 도메인 아래로 온다
(`nomadamas.github.io/slides-grab/` -> `blog.nomadamas.org/slides-grab/`). slides-grab 저장소의
`site`가 아직 옛 주소면 그 저장소가 만드는 canonical과 절대주소 링크도 새 주소로 바꾼다.

---

## Astro

개발 서버는 백그라운드로 띄운다.

```
astro dev --background
```

`astro dev stop`, `astro dev status`, `astro dev logs`로 관리한다.
문서: https://docs.astro.build
