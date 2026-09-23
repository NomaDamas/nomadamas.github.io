# NomaDamas 블로그

<https://nomadamas.github.io>

서울의 AI 오픈소스 해커하우스 [NomaDamas](https://github.com/NomaDamas)의 블로그입니다.
프로젝트를 왜 그렇게 만들었는지, 만들어 보니 뭐가 달랐는지를 적습니다.

## 글 쓰기

`src/content/posts/`에 마크다운 파일을 만들고 main에 푸시하면 GitHub Actions가 빌드해서 배포합니다.

```bash
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # dist/ 생성 + pagefind 색인
pnpm preview  # 빌드 결과 확인
```

프론트매터 형식, 이미지 넣는 법, 건드리면 조용히 망가지는 설정, 색과 로고 규칙은
[`AGENTS.md`](./AGENTS.md)에 있습니다. **글이나 설정을 고치기 전에 그 문서를 먼저 보세요.**

## 검색엔진, 방문 분석 연결

GA4, Microsoft Clarity, Google Search Console, 네이버 서치어드바이저, Bing 연결은 단계별 안내 스크립트로 합니다.

```bash
scripts/setup-seo-services.sh   # gh 로그인 필요
```

## 오타를 발견하셨다면

글 하단의 "이 글 고치기"를 누르면 GitHub 편집 화면으로 바로 갑니다. Pull Request 환영합니다.

## 만든 것

- [Astro](https://astro.build) + [AstroPaper](https://github.com/satnaing/astro-paper) 테마 (MIT)
- GitHub Pages 배포, [pagefind](https://pagefind.app) 검색

테마의 기본 팔레트와 폰트 설정은 NomaDamas 로고에 맞춰 바꿨습니다. 자세한 건 `AGENTS.md`의 「색과 로고」를 보세요.

## 라이선스

코드는 MIT (원 저작자 [Sat Naing](https://github.com/satnaing)). 글의 저작권은 NomaDamas에 있습니다.
