---
title: "블로그를 새로 만들면서 실제로 재본 것들"
description: "정적 블로그를 GitHub Pages에 올리면서 이미지 용량, llms.txt, 네이버 노출, 구글 검색 기대치를 직접 재고 1차 출처로 확인했습니다."
pubDatetime: 2026-09-23T18:00:00+09:00
modDatetime: 2026-09-23T20:10:00+09:00
tags: ["astro", "github-pages", "seo", "이미지"]
featured: true
---

저희는 만든 걸 전부 공개하는 곳인데, 정작 그 얘기를 적을 블로그가 없었어요. 그래서 하나 만들기로 하고
플랫폼부터 골랐습니다. 고르는 김에 평소 그냥 믿고 있던 것들을 직접 재보고 출처를 찾아봤어요.

먼저 결론만 적으면 이렇습니다.

- 이미지는 `src/`에 두면 Astro가 webp로 바꿔 줍니다. 2,394KB PNG 한 장이 16~95KB 파일 다섯 개로 나갔어요.
- `llms.txt`는 구글 검색 순위와 상관이 없어요. 그래도 코딩 에이전트가 읽어 가서 넣었습니다.
- 네이버 첫 페이지 웹문서 14건 중 13건이 외부 사이트였어요.
- 새 페이지가 1년 안에 구글 10위 안에 드는 비율은 2~6%라서, 초반에는 검색 유입을 기대하지 않아요.

## 이미지는 줄여서 올리는 게 아니었다

블로그에 스크린샷을 많이 올릴 예정이라 용량이 걱정됐어요. GitHub Pages는 발행 사이트가 1GB를 넘으면
안 되고, 월 대역폭은 100GB가 soft limit이에요([GitHub 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)).
그래서 처음에는 "커밋하기 전에 이미지를 줄이는 습관을 들여야겠다"고 생각했어요.

틀렸습니다. 중요한 건 압축이 아니라 **어느 폴더에 두느냐**였어요.

Figma에서 내보낸 2,000 x 2,000 PNG 한 장(2,394KB)을 손대지 않고 `src/`에 넣은 다음,
이 블로그 설정 그대로 빌드해 봤어요.

| 빌드가 만든 파일 | 크기 |
|---|---|
| 640px webp | 15.6KB |
| 960px webp | 30.5KB |
| 1280px webp | 46.1KB |
| 1920px webp | 86.7KB |
| 2000px webp | 95.1KB |
| 다섯 개 합계 | 274KB |

원본 PNG는 저장소에만 남고 발행 사이트에는 들어가지 않아요. 방문자의 브라우저는 화면 폭과 픽셀 밀도에
맞는 파일 하나만 받아 갑니다. 레티나 노트북이라면 1920px이나 2000px 파일(87~95KB)을 받고,
폭이 좁은 저해상도 화면이라면 640px 파일(16KB)을 받아요. 저희가 손으로 한 건 없습니다.

단, 이건 이미지를 `src/` 안에 뒀을 때 얘기예요. `public/`에 두면 Astro가 손대지 않고 그대로
내보냅니다. [Astro 공식 문서](https://docs.astro.build/en/guides/images/)에도 "no processing"이라고
적혀 있어요. 같은 PNG가 2,394KB 그대로 나간다는 뜻이고, 발행 용량으로 따지면 274KB와 약 9배 차이예요.
1GB 안에 담을 수 있는 이미지 수도 그만큼 달라집니다.

한 가지 더. 화면 크기별 파일은 저절로 생기지 않아요. Astro의 `image.layout` 기본값은 비어 있어서,
설정하지 않으면 Markdown 이미지는 원본 크기 webp 한 장만 나갑니다. 전역 `image.layout`을 켜면
이번에는 기본 breakpoint 목록 중 원본 폭 이하인 단계마다 파일이 생겨서, 이 PNG는 일곱 개가 돼요.
저희는 본문 폭에 맞춰 단계를 640, 960, 1280, 1920 네 개로 줄였고, 그래서 위 표처럼 다섯 개가 나왔어요.

## llms.txt는 검색 순위용이 아니었다

AI 검색에 인용되려면 `llms.txt`를 둬야 한다는 얘기를 자주 봤어요. 이 글을 처음 올렸을 때는
"넣을 이유가 없다"고 적었는데, 근거를 다시 확인해 보니 절반만 맞았어요.

맞았던 절반은 구글 검색 쪽이에요. 구글 Search Central의
[생성형 AI 최적화 가이드](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)는
AI 개요와 AI 모드를 포함한 구글 검색에 나오는 데 `llms.txt` 같은 AI용 파일이 필요 없고,
구글 검색은 이 파일을 쓰지 않는다고 적고 있어요. 2026년 6월 15일
[개정](https://developers.google.com/search/updates)에서는 다른 서비스를 위해 `llms.txt`를 두는 건
괜찮고, 구글 검색 순위에는 득도 실도 없다는 문장이 더해졌습니다.

틀렸던 절반은 "아무도 안 읽는다"는 부분이에요.

- 구글의 존 뮬러가 2025년 6월에 "현재 llms.txt를 쓰는 AI 시스템은 없다"고 한 말이 자주 인용돼요.
  그런데 이건 공식 문서가 아니라 [블루스카이 답글](https://bsky.app/profile/johnmu.com/post/3lrshm4gggs2v)이고,
  1년도 더 된 얘기예요.
- Ahrefs가 2026년 6월에 낸 [조사](https://ahrefs.com/blog/llmstxt-study/)를 보면, `llms.txt`를 둔 도메인
  약 3만 8천 개 중 97%는 5월 한 달 동안 요청을 한 번도 받지 않았어요. 그런데 요청이 들어온 곳에서는
  요청의 19.5%가 AI 도구였고, 그중 GPTBot이 가장 많았고 Claude Code가 두 번째였어요.
  반면 OAI-SearchBot, PerplexityBot 같은 AI 검색 수집 봇은 전체 요청의 1.1%에 그쳤고요.
- 같은 구글이어도 Chrome의 Lighthouse는 2026년 5월 릴리스부터 실험 단계인 에이전트 브라우징 항목에서
  `llms.txt`를 검사해요([Chrome 문서](https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt)).
  문서는 이 파일을 "새로 떠오르는 관례(emerging convention)"이고 아직은 선택 사항이라고 설명합니다.
- 규격은 제러미 하워드가 2024년 9월에 제안했고 2026년 8월에 [v2](https://llmstxt.org/)가 나왔어요.
  다만 표준화 기구 문서가 아니라 지금도 개인이 낸 제안이에요.

정리하면 `llms.txt`는 검색 순위를 올리는 파일이 아니에요. 코딩 에이전트나 AI 도구가 사이트를 빨리
파악하도록 돕는 안내문에 가까워요. 저희는 빌드할 때 글 목록에서 자동으로 만들도록 해서 관리할 게 없기에
넣었습니다. [nomadamas.github.io/llms.txt](https://nomadamas.github.io/llms.txt)에서 볼 수 있어요.

AI 검색 인용에 실제로 근거가 있는 건 평범한 것들이었어요.

- 검색용 크롤러를 `robots.txt`에서 막지 않기. ChatGPT 검색 결과에 나오려면 OAI-SearchBot을 막지 말라고
  [OpenAI 문서](https://developers.openai.com/api/docs/bots)에 적혀 있어요.
- sitemap 제출하기.
- 본문에 출처와 수치 넣기. 2024년 KDD에 실린 [GEO 논문](https://arxiv.org/abs/2311.09735)에서는
  인용문, 통계 수치, 출처 표기를 넣었을 때 생성형 검색 답변에서 그 출처가 차지하는 비중이 30~40% 늘었어요.
  인용될 확률을 잰 게 아니라, 이미 검색된 출처끼리 답변 속 비중을 비교한 실험이라는 점은 감안해야 해요.

여기서 한 가지 조심할 게 있어요. 호스팅이 크롤러를 열어 둬도 앞단 CDN 설정이 그걸 덮을 수 있습니다.
Cloudflare 프록시(주황 구름)를 켜면 Cloudflare의 AI 봇 설정이 GitHub Pages보다 먼저 적용돼요.
2026년 9월 15일부터는 학습용 봇 차단을 켜 둔 도메인에서 Googlebot, Bingbot 같은 검색 겸용 크롤러까지
막힙니다([Cloudflare 블로그](https://blog.cloudflare.com/accountable-mixed-use-ai-crawlers/)).
그래서 나중에 도메인을 붙일 때는 프록시를 끈 DNS only(회색 구름)로 연결할 예정이에요.

## 네이버는 외부 사이트를 안 잡는다고 알고 있었는데

한국 독자를 생각하면 네이버가 걸립니다. 네이버는 자기네 블로그만 위에 올려주니까 외부 사이트는
소용없다는 얘기를 많이 듣잖아요. 그래서 실제로 검색해 봤어요.

2026년 9월 23일, 로그인하지 않은 상태로 네이버 PC 통합검색에서 "타입스크립트 제네릭"을 검색했어요.
맨 위 AI 브리핑과 네이버 메이트 영역 아래 첫 결과는 외부 사이트인 요즘IT였고, 다음이 네이버 시리즈 e북,
그다음이 네이버 블로그 글 세 개였어요. 그 아래 웹문서 목록 맨 위에는 GitHub Pages로 올린
타입스크립트 핸드북(`joshua1988.github.io`)이 있었습니다. 첫 페이지 웹문서 14건 중 13건이 외부 사이트였고,
AI 브리핑이 인용한 출처 7건 중 3건도 외부 사이트였어요.

물론 키워드 하나로 일반화할 수는 없고, 검색 결과는 시점과 로그인 상태에 따라 달라져요.
새 사이트가 처음 수집되기까지 얼마나 걸리는지도 네이버는 공식 수치를 내지 않아요.
[서치어드바이저 가이드](https://searchadvisor.naver.com/guide/seo-basic-intro)에는 검색로봇이 방문한 뒤
"최대 1주일 이내"에 검색에 반영되고, [수집 요청](https://searchadvisor.naver.com/guide/request-crawl)은
"최소 1일에서 몇 주"가 걸릴 수 있다고만 나와 있어요.

다만 "외부 사이트는 아예 안 잡힌다"는 건 사실이 아니었어요. 네이버
[FAQ](https://searchadvisor.naver.com/guide/faq-start-register)도 웹마스터도구에 등록하지 않은 사이트까지
검색 로봇이 자동으로 수집한다고 적고 있어요. 그래도 등록은 해두려고 해요. 등록하고 소유확인을 하면
sitemap과 RSS를 직접 제출하고, 수집과 노출 리포트를 볼 수 있거든요.

## 그래서 얼마나 기대하고 있나

구글 쪽 기대치는 낮게 잡았어요. Ahrefs가 2025년 5월에 낸
[조사](https://ahrefs.com/blog/how-long-does-it-take-to-rank-in-google-and-how-old-are-top-ranking-pages/)에서
2023년 9월에 새로 발견된 무작위 URL 100만 개 중 1년 안에 구글 상위 10위에 든 비율은 1.74%였어요.
비어 있지 않은 영어 페이지만 따로 보면 6.11%였고요. 글 스무 편에 그대로 곱하면, 1년 안에 10위 안에 드는
글은 0.35편에서 1.2편 정도예요.

그래서 초반 지표는 검색 클릭수 대신 색인된 페이지 수와 노출수로 보기로 했습니다.
읽히는 건 당분간 저희가 직접 옮겨 나르는 쪽이 맞아요.

---

**2026년 9월 23일 수정.** 처음 올린 글에 틀린 내용이 있어 바로잡았어요. 이미지는 스크린샷이 아니라
Figma에서 내보낸 PNG였고, 방문자가 받는 파일은 48KB 한 장이 아니라 화면에 따라 16~95KB예요.
네이버 검색 결과 순서, Ahrefs 수치로 계산한 기대값(0편이 아니라 0.35~1.2편), `llms.txt` 절도 고쳤습니다.

이 블로그는 [Astro](https://astro.build)로 만들어 GitHub Pages에 올립니다.
저장소는 [NomaDamas/nomadamas.github.io](https://github.com/NomaDamas/nomadamas.github.io)에 공개돼 있어요.
설정을 그대로 가져다 쓰셔도 됩니다.
