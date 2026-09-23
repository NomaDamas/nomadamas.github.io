# NomaDamas 블로그

NomaDamas 조직 블로그의 정본이다. 글과 이미지가 전부 이 저장소에 있고, `main`에 push하면
GitHub Actions가 빌드해 GitHub Pages로 배포한다. 현재 주소는 `https://nomadamas.github.io`.

저장소 이름이 곧 주소다. `<org>.github.io`는 org 루트 사이트라 경로 접두사가 붙지 않는다.
이름을 바꾸면 주소가 바뀌고 색인이 초기화되므로 바꾸지 않는다.

velog `@nomadamas`와 dev.to는 재게시 채널이다. 정본이 아니다.
선정 근거는 우산 저장소의 `09-docs/blog-platform-260922.html`과 `09-docs/blog-images-seo-260922.html`에 있다.

테마는 [AstroPaper](https://github.com/satnaing/astro-paper)다. 검색(pagefind), 태그,
페이지네이션, 글별 OG 이미지 자동 생성, 라이트/다크가 이미 들어 있다. 업스트림을 고칠 때는
`astro-paper.config.ts`를 먼저 보고, 컴포넌트를 직접 고치면 나중에 업데이트가 어려워진다.

## 발행

```bash
# 글 하나 추가하고 push하면 끝이다. 별도 업로드 단계가 없다.
git add src/content/posts/<슬러그>.md src/assets/images/
git commit -m "post: <제목>"
git push
```

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

## 웹에서 글쓰기

`app.pagescms.org`에 GitHub으로 로그인하면 브라우저에서 글을 쓰고 이미지를 드래그해 올릴 수 있다.
저장하면 이 저장소에 바로 커밋되고 Actions가 배포한다. 설정은 `.pages.yml`에 있다.

처음 한 번은 org에 Pages CMS GitHub App을 설치해야 한다. 설치 범위는 이 저장소만 고른다.

**아직 UI에서 검증하지 않았다.** 확인할 것은 하나다. 이미지를 드래그했을 때 본문에
`../../assets/posts/파일명` 형태의 상대경로가 들어가는지. 절대경로가 들어가면 Astro가
최적화하지 않아 원본이 그대로 나가므로, 그때는 `.pages.yml`의 `media.output`을 조정한다.

에이전트가 push하는 경로와 충돌하지 않는다. 둘 다 같은 저장소 파일을 고칠 뿐이다.
다만 같은 글을 동시에 건드리지 않는다.

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
  글쓴이 기본값이 조직(NomaDamas)이라 author를 `Person`으로 두면 틀린다. 개인 이름으로 쓴 글만 `Person`이 된다.
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
- **`/privacy/`는 켜진 도구만 적는다.** GA4와 Clarity 약관이 사용 사실 고지를 요구한다.
  분석 도구를 새로 붙이면 `src/pages/privacy.astro`에도 항목을 더한다.
- Bing은 Search Console에서 가져오기로 연결한다. 토큰 없이 확인되고 사이트맵도 따라온다.

## 나중에: 커스텀 도메인 `blog.nomadamas.org`

지금은 `nomadamas.github.io`로 서비스한다. 자체 도메인으로 옮길 때만 아래를 한다.
**순서를 지킨다. DNS가 먼저다.** 반대로 하면 안 뜨는 주소로 리다이렉트된다.

1. 상사에게 Cloudflare DNS 두 건을 한 번에 요청한다.
   `blog` CNAME -> `nomadamas.github.io`, **반드시 회색 구름(DNS only)**.
   프록시를 켜면 인증서 발급이 실패하고, GitHub Pages의 크롤러 개방 상태도 덮인다.
   그리고 org Settings > Pages > Verified domains에서 발급되는 TXT 레코드.
   TXT가 없으면 사이트를 내린 뒤 다른 사람이 서브도메인을 가져갈 수 있다.
2. DNS 반영 확인 후 저장소 Settings > Pages > Custom domain 설정, Enforce HTTPS 체크.
3. `astro-paper.config.ts`의 `site.url`, `astro.config.ts`의 `site`와 `public/robots.txt`의 Sitemap 줄을 새 도메인으로 바꾼다.
   안 바꾸면 canonical이 옛 주소를 가리킨다.
4. `curl -sI https://blog.nomadamas.org`로 `server: GitHub.com` 확인 (프록시 안 탔는지).

---

## Astro

개발 서버는 백그라운드로 띄운다.

```
astro dev --background
```

`astro dev stop`, `astro dev status`, `astro dev logs`로 관리한다.
문서: https://docs.astro.build
