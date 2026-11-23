---
title: "에이전트 시대에도 RAG가 필요할까? AutoRAG 밋업 2026 후기"
description: "에이전트 시대에도 RAG는 사라지지 않고 제때 써야 하는 기술이 됐습니다. 2026년 10월 28일 AutoRAG(오토래그) 밋업 다섯 세션의 핵심과 현장 스케치 영상을 정리했습니다. A recap of the AutoRAG Meetup in Seoul: why RAG still matters for AI agents."
pubDatetime: 2026-11-23T12:41:00+09:00
author: "안승원 (Aiden)"
tags: ["AutoRAG", "AutoRAG 밋업", "오토래그", "RAG", "AI 에이전트", "MCP", "NomaDamas"]
featured: false
draft: false
ogImage: ../../assets/images/autorag-meetup-2026/01-hall.jpg
---
![AutoRAG 밋업 발표장을 객석 뒤에서 본 모습. 양쪽 스크린에 'AutoRAG 에이전트의 세 가지 원칙' 슬라이드가 떠 있고 가운데 연단에서 김동규 님이 마이크를 들고 발표한다. 연단 뒤 벽에는 AutoRAG 밋업 포스터 다섯 장이 붙어 있다. 앞쪽 객석에 참석자들이 앉아 있고 얼굴이 보이는 참석자는 흐리게 처리했다](@/assets/images/autorag-meetup-2026/01-hall.jpg)

에이전트가 파일을 직접 열어 찾아 주는데 RAG가 아직 필요할까요?

이 글은 2026년 10월 28일 AutoRAG 밋업에 오지 못한 개발자와 업무에 AI 에이전트를 써 보려는 비개발자를 위해, 이 질문을 다룬 다섯 세션의 핵심과 현장 영상을 정리한 후기입니다.

RAG(검색 증강 생성)는 AI가 문서나 사내 자료에서 필요한 대목을 먼저 찾은 뒤 그 근거로 답을 만드는 기술입니다. 밋업 신청서에도 에이전트를 쓰면서 RAG를 쓸 일이 줄었다는 고민이 여럿 올라왔습니다.

> **요약**
>
> 1. AutoRAG Meetup은 2026년 10월 28일(수) 서울 역삼 센터필드 AWS Korea에서 열렸습니다. 마커(Markr)와 브레인크루가 주최하고 저희 노마다마스(NomaDamas)가 주관했습니다.
> 2. 김동규 님이 낸 답은 RAG가 사라지지 않고 제때 써야 하는 기술이 됐다는 것입니다. 같은 질문에 AutoRAG 에이전트는 9.4초, 코딩 에이전트 단독은 45.5초 만에 첫 답을 냈습니다.
> 3. 김동규 님의 발표 자료는 [웹 덱](https://dazziapp.com/decks/autorag-meetup-ko/)으로 공개돼 있습니다. 현장 분위기는 [TeddyNote 유튜브 현장 스케치](https://www.youtube.com/watch?v=h0Xpdf9-Hcs)에서 볼 수 있습니다.

## 목차

## AutoRAG 밋업이란?

![AutoRAG 밋업 공식 포스터. 검은 바탕 위쪽에 markr와 Braincrew 로고와 'Community Meetup' 제목이 있다. 가운데에 선과 점으로 그린 그림이, 아래에 큰 글씨 'AutoRAG'와 '26.10.28. Wed. 19:00-21:10', QR 코드가 있다](@/assets/images/autorag-meetup-2026/02-poster.jpg)

AutoRAG Meetup은 오픈소스 검색 에이전트 AutoRAG(오토래그)와 에이전트 시대의 지식 검색을 주제로 연 오프라인 밋업입니다.

| 항목 | 내용 |
|---|---|
| 행사명 | AutoRAG Meetup |
| 일시 | 2026년 10월 28일(수), 오후 6시 30분 입장, 오후 7시부터 9시 10분까지 |
| 장소 | 서울 강남구 테헤란로 231, 역삼 센터필드 EAST 타워 18층 AWS Korea(301호, 400호) |
| 운영 | 주최 Markr, 브레인크루 / 주관 노마다마스 / 협력 NxtCloud, 업스테이지 / 후원 과학기술정보통신부, 정보통신산업진흥원(NIPA) |
| 진행 | 오프닝 이경록(테디, 브레인크루 대표), 사회 안승원(노마다마스 DevRel) |
| 대상 | AI와 에이전트에 관심 있는 개발자, 업무에 에이전트를 써 보고 싶은 비개발자 |
| 신청과 승인 | 신청 310명, 승인 125명 |

125명은 사전 승인 인원이며 실제 참석자 수는 아닙니다. 입장하는 참석자에게는 햄버거 세트와 음료를 준비했습니다.

## 다섯 세션에서는 어떤 이야기가 나왔을까?

브레인크루 이경록(테디) 대표의 오프닝으로 문을 연 뒤 다섯 명의 연사가 차례로 무대에 올랐습니다.

### 김동규 님 ((주)마커 & 노마다마스, AutoRAG팀 리드): 에이전트 시대의 RAG는 적재적소의 기술

![김동규 님 발표 첫 화면. 스크린에 'AutoRAG 에이전트, 에이전트 시대의 RAG를 상상하다' 제목이 떠 있고 오른쪽 연단에서 김동규 님이 발표를 시작한다. 앞쪽에는 뒤돌아 앉은 참석자들이 보인다](@/assets/images/autorag-meetup-2026/03-kim-dongkyu.jpg)

코딩 에이전트는 인덱스(문서 내용을 미리 정리해 두어 빠르게 찾게 돕는 목록)를 만들지 않고 파일을 직접 찾고 열어 읽습니다. 코드에서는 잘 통하지만 문서, 메신저, 메일처럼 흩어진 자료에서는 매번 처음부터 다시 읽어야 해서 시간이 오래 걸립니다.

김동규 님은 같은 컴퓨터에서 같은 질문과 같은 모델(`deepseek-v4.1-flash`)로 세 가지 방식을 실행해 녹화한 비교 영상을 보였습니다. 둘째 방식에 쓴 MCP(Model Context Protocol)는 AI 에이전트가 외부 검색 엔진이나 앱을 연결해 쓰는 표준 규격입니다. 질문에 오타가 섞여 있었는데도 세 방식 모두 정답을 맞혔지만 첫 답이 화면에 보일 때까지 걸린 시간은 크게 갈렸습니다.

| 방식 | 구성 | 첫 답까지 걸린 시간 | 정답 여부 |
|---|---|---:|---|
| AutoRAG 에이전트 | `autorag tui` | 9.4초 | 정답 |
| 코딩 에이전트에 AutoRAG를 MCP로 연결 | `omp` + AutoRAG MCP | 35.1초 | 정답 |
| 코딩 에이전트 단독 | `omp` | 45.5초 | 정답 |

같은 검색 엔진과 인덱스를 써도 MCP로만 붙이면 모델이 먼저 생각하고 검색할지 정한 뒤 결과를 읽느라 35.1초가 걸렸습니다. AutoRAG 에이전트는 모델의 결정을 기다리지 않고 검색을 먼저 출발시켜 첫 답을 냅니다. 첫 답으로 부족할 때만 원문을 다시 찾아 확인합니다.

김동규 님은 이 실험을 바탕으로 에이전트 시대의 RAG가 사라지는 기술이 아니라 적재적소의 기술이라고 정리했습니다. 지금 검색할지, 어디서 찾을지, 얼마나 더 볼지를 제때 판단하는 일이 핵심입니다.

AutoRAG도 이 방향으로 바뀌었습니다. 2024년에는 파이썬으로 만든 RAG 자동 최적화 도구였습니다. 2026년 7월 2.0부터는 TypeScript로 만든 개인용 사서 에이전트(`@autorag/librarian`)입니다. 비개발자도 터미널 없이 쓸 수 있도록 같은 에이전트를 AI 파일 탐색기 Dazzi에 넣은 사례도 소개했습니다.

발표 슬라이드 전체는 [김동규 님 발표 웹 덱](https://dazziapp.com/decks/autorag-meetup-ko/)에서 볼 수 있습니다.

### 윤성재 님 (브레인크루, AI PM): Vectorless RAG와 Evo-RAG

![어두운 발표장에서 윤성재 님이 두 스크린 사이에 서서 발표한다. 스크린에는 'RAG 엔지니어링 대상의 변화' 슬라이드와 단계별 그림 네 개가 있다. 앞쪽 참석자 얼굴은 흐리게 처리했다](@/assets/images/autorag-meetup-2026/04-yun-seongjae.jpg)

윤성재 님은 RAG가 한 번에 잘 찾는 법(Advanced RAG)에서 다시 찾는 법(Agentic RAG), 문서를 직접 뒤져 찾는 법(Vectorless RAG), 찾는 법을 배우는 법(Evo-RAG)으로 옮겨 가는 흐름을 보였습니다. 질문이 "무엇을 찾을까"에서 "어떻게 찾을지를 누가 정할까"로 바뀌는 중입니다. 앞 단계도 다음 단계의 도구로 남는다는 설명입니다.

Vectorless RAG는 문서를 벡터(문장의 뜻을 숫자 목록으로 바꾼 값)로 바꿔 저장하지 않고 검색하는 방식입니다. Evo-RAG는 상황에 맞는 검색 방식을 스스로 찾아가는 방식입니다.

### 김현민 님 (NxtCloud, 리드 AI FDE): 팀 단위 에이전트를 위한 MCP 게이트웨이

![김현민 님이 스크린 앞에서 발표한다. 왼쪽 스크린에 '에이전트는 역할로, 역할은 정책으로' 슬라이드와 겹친 원 세 개 그림이 있다. 참석자 얼굴은 흐리게 처리했다](@/assets/images/autorag-meetup-2026/05-kim-hyeonmin.jpg)

팀 단위로 여러 에이전트를 운영하면 MCP 도구가 늘어날수록 인증과 권한 관리부터 흔들립니다. 김현민 님은 어떤 하네스(AI 모델 바깥에서 도구 호출과 작업 흐름을 제어하는 실행 틀)를 쓰든 그 앞단에서 인증을 통합하는 MCP 게이트웨이를 다뤘습니다.

권한은 에이전트마다 역할을 주고 역할에 붙은 정책과 실행 한도가 모두 허락할 때만 도구를 쓰게 하는 구조입니다. 하위 에이전트는 부모 에이전트의 권한을 넘지 못합니다. 사람의 관리자 권한은 에이전트에게 넘어가지 않습니다.

### 김병욱 님 (런베어, AI Engineer): AutoRAG 오픈소스 개발기

![김병욱 님이 연단 옆에서 마이크를 들고 발표한다. 스크린에는 'Introduction' 슬라이드와 본인 사진, 'Creator of AutoRAG' 소개가 있다. 참석자 얼굴은 흐리게 처리했다](@/assets/images/autorag-meetup-2026/06-kim-byeonguk.jpg)

AutoRAG를 처음 만든 김병욱 님은 2024년에 시작한 AutoRAG 오픈소스 개발기와 오픈소스를 만들며 얻은 것들을 나눴습니다.

### 최송기 님 (업스테이지, AI Research Engineer): 문서 파싱과 Upstage Document Parse 2.0

![최송기 님이 연단에서 발표한다. 양쪽 스크린에 '읽어야 찾는다: RAG의 시작을 바꾸는 VLM, Document Parse 2.0' 제목이 떠 있다. 앞쪽 참석자 얼굴은 흐리게 처리했다](@/assets/images/autorag-meetup-2026/07-choi-songki.jpg)

최송기 님은 짧은 라이트닝 토크로 문서 파싱을 다뤘습니다. 파싱은 문서 속 글자, 표, 차트를 AI가 읽을 수 있는 구조로 풀어내는 과정입니다.

실제 업무 문서는 기계가 읽어 내기 어렵습니다. 표가 깨지고 차트가 빠진 채 색인되면 에이전트도 RAG도 제대로 쓰지 못합니다. 최송기 님은 이 문제와 함께, 비전-언어 모델(이미지와 글을 함께 읽는 AI 모델)로 문서를 읽는 Upstage Document Parse 2.0을 소개했습니다.

## 현장 스케치 영상으로 보는 AutoRAG 밋업

<div style="position:relative;aspect-ratio:16/9"><iframe src="https://www.youtube-nocookie.com/embed/h0Xpdf9-Hcs" title="에이전트 시대에도 RAG가 필요할까? AutoRAG Community Meetup 2026 현장 스케치" style="position:absolute;inset:0;width:100%;height:100%;border:0" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>

*소리 있음. 영상: [TeddyNote 유튜브 채널](https://www.youtube.com/watch?v=h0Xpdf9-Hcs), 브레인크루 영상팀 제작(5분 3초, 2026년 11월 12일 공개)*

영상에는 발표 하이라이트와 참석자 인터뷰가 담겨 있습니다. 회의 중에 에이전트에게 한글 파일을 찾게 했다가 15분이 지나 회의가 끝난 뒤에야 답을 받은 일이 AutoRAG 에이전트를 만든 계기였다는 이야기도 나옵니다.

## 세션 뒤에 이어진 네트워킹

![발표장에서 참석자들이 서서 이야기를 나눈다. 참석자 얼굴과 명찰 이름은 흐리게 처리했다](@/assets/images/autorag-meetup-2026/08-networking.jpg)

세션 사이와 전후로 참석자들은 발표장에서 서로 이야기를 나눴습니다.

## AutoRAG란?

![AutoRAG 저장소 README의 대표 배너. 'AutoRAG Agent: your personal librarian agent. Dazzi is the desktop app.'](@/assets/images/autorag-meetup-2026/09-autorag-banner.png)
*이미지: [AutoRAG GitHub 저장소](https://github.com/Marker-Inc-Korea/AutoRAG)*

**GitHub**: [https://github.com/Marker-Inc-Korea/AutoRAG](https://github.com/Marker-Inc-Korea/AutoRAG)

AutoRAG는 컴퓨터의 문서와 슬랙, 노션, 메일, 카카오톡에 흩어진 자료를 제자리에서 찾아 주는 오픈소스 검색 에이전트입니다. 터미널에서 직접 쓰거나 다른 AI 에이전트에 연결해 쓸 수 있습니다. Apache-2.0 라이선스로 공개돼 있습니다.

설치 방법과 실제 검색 화면, 자주 쓰는 AI 서비스와의 차이는 소개 글 [자료를 옮기지 않고 찾아 주는 오픈소스 AI 사서, AutoRAG Agent](/posts/autorag-agent-intro/)에 있습니다.

## 마치며

에이전트가 파일을 직접 읽는 시대에도 검색을 언제 끼워 넣느냐에 따라 첫 답까지 걸리는 시간이 다섯 배 가까이 달라집니다. 김동규 님 발표가 낸 답도 RAG를 제때 쓰는 것이었습니다.

## 자주 묻는 질문

> [!faq]- AutoRAG 밋업 발표 자료는 어디서 볼 수 있나요?
> 김동규 님의 발표 자료는 [웹 덱](https://dazziapp.com/decks/autorag-meetup-ko/)으로 공개돼 있습니다. 나머지 세션의 주제는 이 글의 세션별 요약과 [Luma 행사 페이지](https://luma.com/wlmnk9mo)에서 볼 수 있습니다.

> [!faq]- 밋업 현장 영상은 어디서 볼 수 있나요?
> 브레인크루 영상팀이 만든 현장 스케치 영상이 [TeddyNote 유튜브 채널](https://www.youtube.com/watch?v=h0Xpdf9-Hcs)에 공개돼 있습니다.

> [!faq]- AutoRAG는 무료로 쓸 수 있나요?
> 네. AutoRAG는 Apache-2.0 라이선스의 오픈소스라 무료로 설치해 쓸 수 있습니다. 설치 방법과 모델 사용에 따른 비용은 [AutoRAG Agent 소개 글](/posts/autorag-agent-intro/)에 정리돼 있습니다.

> [!faq]- Does RAG still matter when AI agents can search files themselves?
> In a recorded experiment shown at the AutoRAG Meetup in Seoul on October 28, 2026, the same question with the same model got a first answer in 9.4 seconds from the AutoRAG agent, 35.1 seconds from a coding agent using AutoRAG through MCP, and 45.5 seconds from a coding agent alone. All three answers were correct. The takeaway: RAG has not disappeared; it has to be used at the right moment.

## 참고 자료

- [AutoRAG Meetup Luma 행사 페이지](https://luma.com/wlmnk9mo) - 일정, 장소, 연사와 세션 소개
- [TeddyNote 유튜브, AutoRAG Community Meetup 2026 현장 스케치](https://www.youtube.com/watch?v=h0Xpdf9-Hcs)
- [김동규 님 발표 웹 덱](https://dazziapp.com/decks/autorag-meetup-ko/) - AutoRAG 에이전트 실험과 구조
- [AutoRAG GitHub 저장소](https://github.com/Marker-Inc-Korea/AutoRAG) - 소스 코드와 설치 안내
- [자료를 옮기지 않고 찾아 주는 오픈소스 AI 사서, AutoRAG Agent](/posts/autorag-agent-intro/) - AutoRAG Agent 소개와 사용법

---

이 글은 AI의 도움을 받아 작성했습니다.
