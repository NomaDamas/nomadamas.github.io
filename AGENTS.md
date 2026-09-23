# NomaDamas 블로그

NomaDamas 조직 블로그의 정본이다. 글과 이미지가 전부 이 저장소에 있고, `main`에 push하면
GitHub Actions가 빌드해 GitHub Pages로 배포한다. 주소는 `https://blog.nomadamas.org`.

velog `@nomadamas`와 dev.to는 재게시 채널이다. 정본이 아니다.
선정 근거는 우산 저장소의 `09-docs/blog-platform-260922.html`과 `09-docs/blog-images-seo-260922.html`에 있다.

## 발행

```bash
# 글 하나 추가하고 push하면 끝이다. 별도 업로드 단계가 없다.
git add src/content/blog/<슬러그>.md src/assets/posts/<슬러그>/
git commit -m "post: <제목>"
git push
```

## 이미지

- **이미지는 `src/assets/posts/<슬러그>/`에 둔다.** 글에서 상대경로로 참조한다:
  `![설명](../../assets/posts/<슬러그>/foo.png)`
- **원본을 그대로 커밋한다.** 빌드할 때 Astro가 webp로 변환하고 srcset을 만든다.
  실측으로 2,340KB 스크린샷이 독자에게는 48KB로 간다. 커밋 전에 손으로 줄이지 않는다.
- **`public/`에 이미지를 넣지 않는다.** Astro가 `public/`은 처리하지 않아 원본이 그대로 나간다.
  용량과 대역폭 견적이 19배 갈리는 유일한 변수다. 예외는 Astro가 다루지 않는 동영상뿐이다.
- **GIF를 커밋하지 않는다.** 실측 2,976KB GIF가 mp4로 377KB다. 움짤은 mp4로 만들어 `public/videos/`에 둔다.
  개별 파일 100MiB를 넘으면 push 자체가 거부된다.
- **Git LFS를 쓰지 않는다.** 공식 문서에 `Git LFS cannot be used with GitHub Pages sites`이고,
  평균 150KB 이미지에는 불필요한 복잡도다.

## 건드리기 전에 알아야 할 설정

`astro.config.mjs`의 세 항목은 빼면 조용히 망가진다.

| 항목 | 빼면 |
|---|---|
| `site` 절대 URL | 네이버가 sitemap을 수집하지 않는다 |
| `image.layout: 'constrained'` | srcset이 한 장도 안 생긴다. 원본 해상도 1장만 내려간다 |
| `image.breakpoints` | 기본 8단계라 이미지 1장이 8개 파일이 된다 |

`public/robots.txt`는 정적 파일로 둔다. 동적 라우트가 5xx를 내면 네이버가 사이트 전체를 수집 금지로 읽는다.

## URL 구조

`/posts/<슬러그>/`로 고정한다. GitHub Pages는 경로별 서버사이드 301을 만들 수 없고
Astro의 redirects는 meta refresh HTML만 뱉는다. 한번 발행한 주소는 되돌리기 어렵다.

## 하지 않는 것

- **`llms.txt`를 만들지 않는다.** 2025-06-17 구글 Mueller가 어떤 AI 시스템도 쓰지 않는다고 했고,
  13.7만 사이트 조사에서 97%가 트래픽 0이었다. AI 검색 인용은 평범한 색인과 본문 품질에서 온다.
- **재게시할 때 canonical을 빼지 않는다.** 없으면 도메인 권위가 높은 velog가 대표로 잡혀
  정본을 자체 도메인에 둔 결정이 무의미해진다.
- **로컬 맥에 자동화를 걸지 않는다.** 발행 자동화는 GitHub Actions나 클라우드 세션의 push로만 한다.

## 배포 전 체크리스트

- [ ] 템플릿 샘플 글 5개 삭제 (`first-post`, `second-post`, `third-post`, `markdown-style-guide`, `using-mdx`)
- [ ] `src/pages/index.astro`와 `about.astro`의 Astro 템플릿 문구를 노마다마스 소개로 교체
- [ ] `src/components/Footer.astro`의 소셜 링크를 실제 계정으로 교체
- [ ] Cloudflare DNS: `blog` CNAME -> `nomadamas.github.io`, **회색 구름(DNS only)**
- [ ] org Settings > Pages > Verified domains에서 발급한 TXT 레코드 추가 (서브도메인 takeover 방지)
- [ ] 저장소 Settings > Pages > Source를 GitHub Actions로, 도메인 연결 후 Enforce HTTPS
- [ ] Search Console과 네이버 서치어드바이저 소유확인, sitemap과 RSS 제출
- [ ] 배포 후 `curl -sI https://blog.nomadamas.org`로 `server: GitHub.com` 확인 (프록시 안 탔는지)

---

## Astro

개발 서버는 백그라운드로 띄운다.

```
astro dev --background
```

`astro dev stop`, `astro dev status`, `astro dev logs`로 관리한다.
문서: https://docs.astro.build
