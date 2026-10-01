---
title: "오픈소스 RAG 비교: AnythingLLM, Open WebUI, Dify, AutoRAG Agent에 한글 파일과 카톡을 넣어 봤습니다"
description: "AnythingLLM, Open WebUI, Dify, AutoRAG Agent에 같은 한글(HWP) 파일, 카카오톡 대화, 메일을 넣고 같은 질문을 3번씩 물었습니다. 한글 파일을 읽은 것은 AutoRAG Agent뿐이었고, 바뀐 최신 값은 AnythingLLM이 더 안정적으로 찾았습니다."
pubDatetime: 2026-10-01T22:12:00+09:00
author: "안승원 (Aiden)"
tags: ["rag", "오픈소스 rag", "anythingllm", "open webui", "dify", "autorag agent", "한글 파일", "카카오톡 검색"]
ogImage: ../../assets/images/open-source-rag-comparison/00-cover.png
featured: true
---
> **요약**
>
> 1. [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm), [Open WebUI](https://github.com/open-webui/open-webui), [Dify](https://github.com/langgenius/dify), [AutoRAG Agent](https://github.com/Marker-Inc-Korea/AutoRAG)에 같은 자료(문서 36개, 메일 35통, 카카오톡 대화방 4개)를 넣고, 같은 질문 세 개를 3번씩 물었습니다. 답하는 모델은 모두 `gpt-6-luna`로 맞췄습니다.
> 2. 한글(HWP) 파일은 기본 설정에서 AnythingLLM과 Dify가 올리기부터 거부했고, Open WebUI는 받았지만 깨진 글자로 읽었습니다. 한글 파일에만 있는 심사 기준을 맞힌 것은 AutoRAG Agent뿐이었습니다(3번 중 3번).
> 3. 카카오톡에만 있는 결정(누가 정원을 늘리자고 했나)은 AnythingLLM과 AutoRAG Agent가 3번 모두 맞혔습니다. Open WebUI는 제안한 사람을 답했고, Dify는 결정한 사람을 알 수 없다고 답했습니다. 세 도구는 카톡을 대화방마다 내보내 올렸고, AutoRAG Agent는 카톡을 연결해 찾았습니다.
> 4. 정원이 80명에서 100명으로 바뀐 것은 AnythingLLM이 3번 모두, AutoRAG Agent가 3번 중 2번 맞혔습니다. Open WebUI는 3번 모두 옛 값 80명을 답했습니다.
> 5. 한글 파일과 카톡, 메일을 옮기지 않고 함께 찾으려면 AutoRAG Agent, 올린 문서와 화면에서 대화하려면 AnythingLLM, 팀이 함께 쓸 챗 화면은 Open WebUI, AI 앱과 워크플로를 만들려면 Dify가 맞습니다. AutoRAG Agent는 저희 NomaDamas를 운영하는 Markr의 프로젝트입니다.

## 목차

## 내 자료로 AI 검색, 어떤 오픈소스 RAG를 쓸까?

"부산 해커톤 정원 지금 몇 명이죠?"

행사 계획서에는 80명이라고 적혀 있습니다. 그런데 9월에 팀 단톡방에서 100명으로 늘렸고, 행사장에는 메일로 다시 물었습니다. 계획서는 한글(HWP) 파일이고, 결정은 카카오톡에, 확인은 메일에 남았습니다. 답을 알려면 한글 파일, 단톡방, 메일함을 차례로 열어 날짜를 맞춰 봐야 합니다.

이 일을 AI에게 맡기는 방식이 RAG(검색 증강 생성)입니다. AI가 답하기 전에 내 자료에서 관련 내용을 먼저 찾아 읽게 합니다. 내 컴퓨터나 서버에 설치하는 오픈소스 RAG 도구를 찾아보면 Dify, AnythingLLM, Open WebUI가 가장 많이 나옵니다.

영어와 일본어로 된 비교 글은 여럿 있지만, 한글 파일과 카톡을 넣어 본 비교는 찾지 못했습니다. 그래서 같은 자료를 넣고 직접 물어봤습니다.

## 비교한 네 가지

![네 도구를 소개하는 카드 네 장. AnythingLLM은 파일을 올려 작업공간별로 대화하는 데스크톱 앱, Open WebUI는 ChatGPT 같은 화면을 내 서버에 띄우는 웹 앱, Dify는 지식 검색과 워크플로로 AI 앱을 만드는 플랫폼, AutoRAG Agent는 자료를 옮기지 않고 원래 자리에서 찾는 명령줄 검색 도구다. AutoRAG Agent 카드에는 Markr 프로젝트라는 표시가 있다](@/assets/images/open-source-rag-comparison/01-tools.png)
*로고는 각 저장소와 GitHub 조직이 배포한 이미지입니다.*

- **[AnythingLLM](https://github.com/Mintplex-Labs/anything-llm)**: 작업공간을 만들고 파일을 올려 대화합니다. 데스크톱 앱이 있어 클릭만으로 시작할 수 있습니다. MIT 라이선스입니다.
- **[Open WebUI](https://github.com/open-webui/open-webui)**: ChatGPT와 비슷한 화면을 내 서버에 띄웁니다. Ollama 같은 로컬 모델과 OpenAI 호환 모델을 붙여 쓰고, 지식(Knowledge)에 파일을 올려 검색합니다.
- **[Dify](https://github.com/langgenius/dify)**: 지식 검색, 워크플로, 챗봇을 묶어 AI 앱을 만드는 플랫폼입니다. 클라우드 서비스로 쓰거나 Docker로 직접 띄울 수 있습니다.
- **[AutoRAG Agent](https://github.com/Marker-Inc-Korea/AutoRAG)**: 문서 폴더, 메일, 메신저를 원래 자리에 둔 채 질문 하나로 함께 찾는 명령줄 도구입니다. Claude Code(클로드 코드)나 Codex에서 불러 쓸 수 있습니다. AutoRAG 저장소에서 나오는 도구라 star는 AutoRAG 이름으로 집계됩니다. 자세한 소개는 [지난 글](/posts/autorag-agent-intro/)에 있습니다.

| 도구 | GitHub star (2026-10-01) | 이번에 쓴 버전 |
|---|---|---|
| [Dify](https://github.com/langgenius/dify) | 157,655 | 1.17.1 |
| [Open WebUI](https://github.com/open-webui/open-webui) | 153,708 | 0.11.4 |
| [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) | 66,646 | 1.16.2 |
| [AutoRAG Agent](https://github.com/Marker-Inc-Korea/AutoRAG) (AutoRAG 저장소) | 5,110 | 2.6.1 + 수정 2건(아래 주의 상자) |

## 이렇게 비교했습니다

가상 회사 '한빛랩스'의 자료를 만들어 네 도구에 똑같이 넣었습니다. DevRel 담당자가 부산 해커톤을 준비하면서 한 달 동안 주고받은 자료입니다.

![시연 상황 그림. 가상 회사 한빛랩스의 DevRel 담당 한지우가 10월 17일 부산 해커톤을 준비하고 있고, 네 도구에 심사 기준과 배점, 정원 증원을 결정한 사람, 지금 정원을 묻는다. 넣은 자료는 문서 36개(한글 파일 7개 포함), 메일 35통, 카카오톡 대화방 4개다. 심사 기준은 8월 14일 한글 파일에만 완성도 40, 창의성 30, 발표 30으로 있고, 증원 결정은 9월 16일 팀 단톡방에서 한지우가 제안하고 박준영이 좋아요 100명으로 가죠라고 답한 것이 전부다. 정원은 8월 14일 계획서 HWP와 PPT에 80명으로 적힌 옛 값이고, 9월 16일 단톡방에서 100명으로 확정되고 9월 17일 행사장 메일에서 다시 언급된다. 아래에는 다른 주최 측의 11월 해커톤(정원 60명) 이야기와 공공기관 한글 파일 6개처럼 질문과 상관없는 자료도 섞여 있다는 설명이 있다](@/assets/images/open-source-rag-comparison/02-scenario.png)
*질문마다 정답이 어디에 있는지 정리한 그림입니다. 뒤의 결과 화면과 맞춰 볼 수 있습니다.*

- **자료**: 문서 36개(PDF, 워드, 엑셀, 파워포인트, 텍스트, 한글 파일 7개), 메일 35통, 카카오톡 대화방 4개. 한글 파일 7개 중 6개는 공공누리 제1유형으로 공개된 공공기관 보도자료와 서식입니다(출처는 글 끝 참고 자료).
- **넣은 방법**: 세 도구에는 파일을 올렸습니다. 카톡은 맥 카카오톡의 대화 내보내기 형식(CSV)으로 대화방마다 올렸습니다. 메일은 AnythingLLM에 `.mbox`, Open WebUI에 `.eml`로 올렸고, Dify는 기본 설정에서 `.eml`을 받지 않아 메일 없이 쟀습니다. AutoRAG Agent는 문서 폴더를 지정하고 메일 폴더와 카카오톡을 연결했습니다. 카카오톡 연결에는 실제 대화 대신 같은 모양의 합성 대화를 넣었습니다.
- **모델**: 답은 네 도구 모두 OpenAI `gpt-6-luna`가 씁니다. 임베딩은 글을 숫자로 바꿔 비슷한 내용을 찾게 하는 모델입니다. 한국어를 찾을 수 있게 AnythingLLM과 Open WebUI는 다국어 모델(multilingual-e5-small)로, Dify는 OpenAI `text-embedding-3-small`로 바꿨고, AutoRAG Agent는 내장 임베딩을 썼습니다.
- **바꾼 설정**: 답이 나오게 하려고 AnythingLLM은 온도를 1로, 대화 방식을 chat으로 바꿨고, Dify는 OpenAI 호환 공급자로 모델을 붙였습니다. 검색 설정은 기본값에 가깝게 두었습니다.
- **횟수**: 질문마다 새 대화로 3번씩 물었습니다. 세 도구는 API로, AutoRAG Agent는 `autorag search`로 물었습니다. AutoRAG Agent는 실행마다 검색 기억을 비우고 시작했습니다.

> [!WARNING]
> **AutoRAG Agent는 아직 출시되지 않은 수정판으로 쟀습니다.** 지금 npm 최신판 2.6.1에서는 `autorag search`가 답을 정리하는 단계에서 아래 메시지를 내고 끝납니다. AI 모델이 검색 도구 목록을 받지 못하는 문제입니다. 고치는 PR([#1741](https://github.com/Marker-Inc-Korea/AutoRAG/pull/1741))이 리뷰 중입니다.
>
> ```text wrap
> The search run for "부산 해커톤 심사 기준과 배점은 어떻게 되나요?" ended without finalized results: the agent ended its run without calling emit_autorag_results, so no curated answer is available within the configured search range.
> ```
>
> 아래 AutoRAG Agent 결과는 #1741과, 첫 검색이 카톡과 메일을 건너뛰던 문제를 고친 [#1754](https://github.com/Marker-Inc-Korea/AutoRAG/pull/1754)를 합친 빌드에서 나온 값입니다. #1754는 이번 비교를 하다 찾아 올린 PR입니다. 모델 없이 찾기만 하는 Lite 모드는 2.6.1에서도 동작합니다.

## 한눈에 보기

| | AnythingLLM | Open WebUI | Dify | AutoRAG Agent |
|---|---|---|---|---|
| 쓰는 곳 | 데스크톱 앱, 웹 | 웹 | 웹 | 터미널, Claude Code, Codex |
| 자료를 두는 곳 | 올린 파일을 변환해 앱 안에 저장 | 올린 파일을 서버에 복사 | 올린 파일을 서버에 복사 | 원본은 그대로 두고 색인만 따로 만듦 |
| 한글(HWP, HWPX) | 올리기 거부 | 받지만 깨진 글자로 읽음(기본 엔진) | 올리기 거부 | 읽음(표 포함) |
| 카카오톡 | 대화방마다 내보내 올림 | 대화방마다 내보내 올림 | 대화방마다 내보내 올림 | 연결해서 찾음(Apple Silicon 맥) |
| 메일 | `.mbox` 올림 | `.eml` 올림 | 기본 설정에서는 `.eml` 거부 | 메일함이나 내보낸 파일 연결 |
| 출처 표시 | Sources 버튼에 파일 목록 | 답 옆 파일 이름 칩, 누르면 원문 | 인용 기능을 켜면 문서 이름과 원문(문서 기준) | 답마다 번호, 파일 경로, 근거 요약 |
| 새 자료 반영 | 다시 올림(실험 기능 Live sync는 웹과 커넥터만) | 다시 올림(자동 동기화는 별도 도구 oikb) | 다시 올림 | `autorag refresh`로 바뀐 것만 |

## 직접 넣어 본 결과

| 질문 | AnythingLLM | Open WebUI | Dify | AutoRAG Agent |
|---|---|---|---|---|
| 1. 심사 기준과 배점은? (한글 파일에만 있음) | 0/3 | 0/3 | 0/3 | 3/3 |
| 2. 정원을 늘리자고 결정한 사람은? (카톡에만 있음) | 3/3 | 0/3 | 0/3 | 3/3 |
| 3. 참가 정원은 지금 몇 명? (80명에서 100명으로 바뀜) | 3/3 | 0/3 | 3/3 | 2/3 |

AutoRAG Agent를 뺀 세 도구는 카톡을 내보낸 파일로 넣었습니다. 0/3에는 틀린 답과 "자료에 없다"는 답이 섞여 있습니다. 질문마다 아래에서 풉니다.

### 한글(HWP) 파일은 읽을까?

공공기관 공고문, 학교 가정통신문, 회사 기안서는 아직 한글 파일로 오가는 경우가 많습니다. 네 도구에 한글 파일 7개를 넣어 봤습니다.

AnythingLLM은 파일 확장자에서 바로 거부했습니다.

![AnythingLLM 문서 업로드 창. Documents 탭과 My Documents 아래 업로드 칸에 devrel-h2-plan.hwp와 File extension .hwp not supported for parsing and cannot be assumed as text file type이라는 빨간 오류가 빨간 상자로 표시되어 있다. 가운데 문서 목록은 잘라 냈다](@/assets/images/open-source-rag-comparison/03-anythingllm-hwp.png)
*AnythingLLM 1.16.2 업로드 창. 가운데 문서 목록은 잘라 냈습니다. 2026-10-01 캡처.*

```text wrap
File extension .hwp not supported for parsing and cannot be assumed as text file type.
```

Dify는 받을 수 있는 형식 목록에 한글 파일이 없어 파일 선택 창에 한글 파일이 보이지 않습니다. 같은 이유로 기본 설정에서는 파워포인트와 `.eml` 메일도 올라가지 않았습니다.

![Dify 지식 만들기 화면의 파일 업로드 칸. Supports XLS, CSV, DOCX, HTML, XLSX, TXT, MDX, PDF, MD, VTT, MARKDOWN, PROPERTIES, ODT, HTM이라는 안내가 빨간 상자로 표시되어 있다](@/assets/images/open-source-rag-comparison/04-dify-hwp.png)
*Dify 1.17.1. 받을 수 있는 형식에 HWP가 없습니다. 2026-10-01 캡처.*

Open WebUI는 한글 파일을 받았습니다. 그런데 올린 파일을 열어 보면 내용 대신 깨진 글자가 들어 있습니다. 기본 문서 변환 엔진에 한글 파일 변환기가 없어 파일의 바이트를 그대로 글자로 읽은 것입니다.

![Open WebUI 지식에 올라간 devrel-h2-plan.hwp의 내용 화면. 한글 내용 대신 Root Entry, FileHeader, DocInfo, BodyText 같은 파일 구조 이름과 알아볼 수 없는 기호가 이어지며 빨간 상자로 표시되어 있다](@/assets/images/open-source-rag-comparison/05-openwebui-hwp.png)
*Open WebUI 0.11.4. 기본 엔진으로 올린 한글 파일의 내용입니다. 2026-10-01 캡처.*

그래서 한글 파일에만 적힌 심사 기준을 물으면 세 도구 모두 3번 다 "자료에 없다"고 답했습니다. AnythingLLM의 출처 목록을 열어 보면 한글 파일 대신 같은 계획서의 PPT, 메일, 예산표, 다른 카톡방이 잡혀 있습니다.

![AnythingLLM의 답과 출처 목록. 공유된 자료에는 부산 해커톤의 심사 기준이나 배점이 나와 있지 않다는 답이 빨간 상자로, 오른쪽 Sources 목록의 devrel-h2-plan.pptx, 10-17.mbox, budget-2026-q4.xlsx, 카카오톡 대화 부산 개발자 모여라 오픈채팅 CSV가 빨간 상자로 표시되어 있다. 한글 파일은 목록에 없다](@/assets/images/open-source-rag-comparison/07-anythingllm-q1.png)
*AnythingLLM 1.16.2, gpt-6-luna. 답 아래 Sources를 눌러 연 출처 목록을 답 밑에 붙였습니다. Open WebUI와 Dify도 자료에 없다고 답했습니다. 2026-10-01 캡처.*

AutoRAG Agent는 한글 파일을 표까지 읽어 3번 모두 정답을 냈습니다. 근거로도 한글 파일을 가리켰습니다.

![터미널에서 autorag search로 부산 해커톤 심사 기준과 배점을 물은 화면. 심사 총점은 100점이고 완성도 40점, 창의성 30점, 발표 30점이라는 답이 초록, 근거 경로 끝의 devrel-h2-plan.hwp가 초록 상자로 표시되어 있다. 아래에는 2026-08-14 작성된 운영 계획(안)에 이 배점이 적혀 있고 초안이라는 근거 요약이 있다](@/assets/images/open-source-rag-comparison/06-autorag-q1.png)
*AutoRAG Agent 2.6.1 + PR #1741, #1754 빌드, gpt-6-luna. 표의 3회와 별도로 같은 빌드에서 다시 실행한 화면이고, 답을 확정하기 전에 먼저 나오는 빠른 답은 잘라 냈습니다. 2026-10-01 캡처.*

3번 중 2번은 답에 "출처가 운영 계획안(초안)이라 최종 확정됐는지는 따로 확인이 필요하다"는 말을 덧붙였습니다.

### 카카오톡 대화는 어떻게 넣을까?

AnythingLLM, Open WebUI, Dify에는 카톡을 넣는 기능이 따로 없습니다. 카카오톡 앱에서 대화방마다 "대화 내보내기"를 해서 나온 파일을 올려야 합니다. 대화방이 4개면 4번, 내일 새 메시지가 오면 다시 내보내 올려야 합니다.

AutoRAG Agent는 카톡을 연결해 두면 대화방을 고르지 않고 함께 찾습니다. 새 메시지는 `autorag refresh`를 돌리면 새로 쌓인 것만 골라 읽습니다. 카톡 연결은 Apple Silicon 맥에서 카카오톡 앱을 켜 둔 상태로 되고, 연결 도구(lazykatok) 설치와 맥 시스템 설정의 전체 디스크 접근 권한이 처음 한 번 필요합니다.

카톡에만 있는 결정을 물었습니다. 9월 16일 팀 단톡방에서 한지우가 "정원 100명으로 늘리는 거 어떨까요?"라고 묻고, 대표 박준영이 "좋아요 100명으로 가죠"라고 답한 대화입니다. 정답은 박준영입니다.

![터미널에서 autorag search로 정원을 100명으로 늘리자고 결정한 사람을 물은 화면. 박준영이 부산 해커톤 정원을 100명으로 늘리자고 결정했다는 답이 초록, 근거 경로 /kakao/hanbit/chunks/window_fe1b96c5aeeed253이 초록 상자로 표시되어 있다. 아래에는 한지우가 정원 확대를 제안한 대화에서 박준영이 100명으로 진행하자고 답했다는 근거 요약이 있다](@/assets/images/open-source-rag-comparison/08-autorag-q2.png)
*AutoRAG Agent 2.6.1 + PR #1741, #1754 빌드. 표의 3회와 별도로 다시 실행한 화면입니다. 근거 경로가 `/kakao/`로 시작하면 카톡 대화입니다. 2026-10-01 캡처.*

내보낸 파일을 올리면 다른 도구도 카톡 내용을 검색할 수 있습니다. 결과는 갈렸습니다. AnythingLLM은 3번 모두 박준영이라고 답했습니다. Open WebUI는 3번 모두 제안한 사람인 한지우를 답했고, Dify는 3번 모두 한지우가 제안한 것만 찾고 결정한 사람은 알 수 없다고 답했습니다.

### 값이 바뀐 자료에서 최신 값을 찾을까?

정원은 8월 계획서에 80명, 9월 카톡과 메일에 100명으로 남아 있습니다. 옛 값과 새 값이 함께 있을 때 새 값을 고르는지 봤습니다.

Open WebUI는 3번 모두 계획서의 80명을 답했습니다.

![Open WebUI의 답. 부산 해커톤 참가 정원은 80명이라는 문장과 근거 칩 devrel-h2-plan.pptx, 11월에 다른 주최 측이 여는 해커톤은 정원 60명이라는 문장이 빨간 상자로 표시되어 있다. 아래에는 카카오톡 대화 부산 개발자 모여라 오픈채팅 CSV 칩과 3 Sources 버튼이 있다](@/assets/images/open-source-rag-comparison/09-openwebui-q3.png)
*Open WebUI 0.11.4, gpt-6-luna. 8월 계획서의 80명을 지금 정원으로 답했습니다. 2026-10-01 캡처.*

표의 결과는 API로 3번 물은 값입니다. 같은 질문을 채팅 화면에서 다시 물었을 때는 2번 중 1번 100명이 나왔습니다.

AnythingLLM은 3번 모두 100명이라고 답했습니다. Dify도 3번 모두 100명이었지만, Dify에는 80명이 적힌 계획서(HWP, PPT)와 메일이 올라가지 않아 옛 값이 없는 상태에서 답한 결과입니다.

AutoRAG Agent는 3번 중 2번 100명이라고 답했습니다. 나머지 1번은 "100명으로 늘리려는 문의는 있었지만 승인됐는지는 확실하지 않다"고 답했습니다. 그 답은 카톡의 결정 대신 행사장에 증원을 문의한 9월 17일 메일과 8월 계획서를 근거로 삼았습니다.

![터미널에서 autorag search로 지금 참가 정원을 물은 화면. 현재 확인되는 정원은 100명이고 기존 계획은 80명이었으나 신청 증가에 따라 100명으로 늘리려는 요청이 이후 전달됐다는 답이 초록, 근거 1의 9월 17일 메일 경로가 초록 상자, 근거 2의 8월 계획서 devrel-h2-plan.pptx가 주황 상자로 표시되어 있다](@/assets/images/open-source-rag-comparison/10-autorag-q3.png)
*AutoRAG Agent 2.6.1 + PR #1741, #1754 빌드. 표의 3회와 별도로 다시 실행한 화면입니다. 새 값(9월 메일)과 옛 값(8월 계획서)을 함께 근거로 들었습니다. 2026-10-01 캡처.*

이 질문은 AnythingLLM이 가장 안정적이었습니다. 위 AutoRAG Agent 화면은 옛 값과 새 값을 날짜와 함께 나란히 보여 줘서, 계획서의 80명이 왜 지금 정원이 아닌지 답에서 확인할 수 있습니다.

### 출처는 어떻게 보여 줄까?

답이 맞는지 확인하려면 어느 자료에서 왔는지 봐야 합니다.

- **AnythingLLM**: 답 아래 Sources를 누르면 근거로 쓴 파일 목록이 나옵니다(위 AnythingLLM 화면).
- **Open WebUI**: 답 문장 옆에 파일 이름 칩이 붙고, 누르면 찾은 원문과 관련도가 나옵니다(아래 화면).
- **Dify**: 인용 기능을 켜면 답 아래에 문서 이름과 원문 조각이 붙습니다(Dify 문서 기준).
- **AutoRAG Agent**: 답 문장마다 번호를 달고, 번호마다 파일 경로나 대화 위치와 근거 요약을 붙입니다(위 터미널 화면).

![Open WebUI의 출처 창. devrel-h2-plan.pptx 제목 아래 Content 95.13%와 DevRel 2026 하반기 계획 원문이 있고, 부산 해커톤 2026-10-17 참가 정원 80명 장소 부산 센텀시티 줄이 주황 상자로 표시되어 있다](@/assets/images/open-source-rag-comparison/11-openwebui-citation.png)
*Open WebUI 0.11.4에서 80명 답의 근거 칩을 누른 화면입니다. 원문을 보면 8월 계획서의 값이라는 것을 바로 알 수 있습니다. 2026-10-01 캡처.*

## 이럴 때는 이 도구

이번 비교는 한글 파일과 카톡처럼 한국에서 흔한 자료를 기준으로 했습니다. 한글 파일이 필요 없는 질문 2와 3만 보면 AnythingLLM이 6번 모두 맞혀 AutoRAG Agent(6번 중 5번)보다 정확했습니다.

- **AnythingLLM**: PDF, 워드, 파워포인트를 올려 화면에서 대화하고 싶을 때. 데스크톱 앱이 있어 설치가 간단하고, 카톡도 내보낸 파일로 올리면 찾아 줍니다.
- **Open WebUI**: 팀이 함께 쓸 ChatGPT 같은 화면을 직접 운영하고 싶을 때. 로컬 모델과 클라우드 모델을 한 화면에서 바꿔 쓸 수 있습니다. 한글 파일은 기본 엔진에서 깨지니 PDF로 바꿔 올리는 편이 낫습니다.
- **Dify**: 검색 결과를 워크플로에 넣어 고객용 챗봇이나 사내 AI 앱을 만들 때. 기본 설정에서 받는 파일 형식이 좁으니 쓰는 형식을 먼저 확인하세요.
- **AutoRAG Agent**: 한글 파일, 카톡, 메일을 옮기거나 내보내지 않고 함께 찾고 싶을 때. 화면 없이 터미널에서 쓰고, Claude Code나 Codex에게 맡길 수 있습니다. 질문 하나에 검색을 여러 번 하고 원문을 다시 읽어서 모델 사용료가 더 듭니다. 이번 시연에서 `gpt-6-luna`를 붙였을 때 질문 하나에 평균 약 0.6센트였고, 다른 세 도구는 0.1센트 미만이었습니다.

## AutoRAG Agent 시작하기

AutoRAG Agent는 명령줄 도구지만 명령어를 외울 필요는 없습니다. Claude Code나 Codex에게 한국어로 부탁하면 저장소의 설치 안내(스킬)를 읽고 설치와 연결을 대신해 줍니다. 컴퓨터에는 [Node.js](https://nodejs.org/ko/download) 24 이상이 있어야 합니다. 카톡까지 연결하려면 연결 도구 lazykatok을 Rust로 빌드해 설치해야 해서 [Rust](https://www.rust-lang.org/ko/tools/install)도 필요합니다.

검색할 폴더에서 Claude Code를 열고 아래처럼 부탁해 보세요.

```text wrap
AutoRAG Agent를 설치해서 이 폴더의 문서를 검색할 수 있게 설정해 줘. AI 모델 없이 쓰는 Lite 모드로 하고, 방법은 github.com/Marker-Inc-Korea/AutoRAG 저장소의 skills/autorag-lite-setup/SKILL.md를 읽고 따라 줘.
```

Lite 모드는 AutoRAG가 모델 없이 찾기만 하고, 찾은 내용은 Claude Code나 Codex가 읽고 정리합니다. 그래서 AutoRAG에는 API 키가 필요 없고, 위 주의 상자의 2.6.1 문제와도 관계없습니다. 설정이 끝나면 "부산 해커톤 심사 기준 AutoRAG로 찾아서 근거 파일도 알려 줘"처럼 평소 말로 물으면 됩니다. 카톡은 "카카오톡도 연결해 줘"라고 이어서 부탁하면 됩니다.

Lite 모드는 찾기만 하므로 값이 바뀐 질문에서는 옛 값이 먼저 나올 수 있습니다. 근거 파일의 날짜를 함께 보세요. 부탁부터 답까지의 실제 화면은 [지난 글의 따라 하기](/posts/autorag-agent-intro/#claude-code에게-맡겨-보기)에 있습니다.

## 마치며

차이는 한글 파일과 카톡에서 났습니다. 세 도구는 기본 설정에서 한글 파일을 읽지 못했고, 카톡은 대화방마다 내보내 올려야 했습니다. AutoRAG Agent는 둘 다 원래 자리에서 찾았지만, 바뀐 정원을 묻는 질문에서는 3번 중 1번 확정하지 못해 AnythingLLM보다 못했습니다.

#1741이 머지되기 전까지 2.6.1에서 질문하려면 모델 없이 찾는 Lite 모드를 쓰면 됩니다.

- **AutoRAG 저장소**: [github.com/Marker-Inc-Korea/AutoRAG](https://github.com/Marker-Inc-Korea/AutoRAG). 도움이 됐다면 star를 눌러 주세요
- **이번에 올린 수정**: [#1754 첫 검색에 연결된 소스 포함](https://github.com/Marker-Inc-Korea/AutoRAG/pull/1754), [#1755 모델 요청 오류 원문 표시](https://github.com/Marker-Inc-Korea/AutoRAG/pull/1755)
- **버그와 제안**: [AutoRAG 이슈](https://github.com/Marker-Inc-Korea/AutoRAG/issues)

## 자주 묻는 질문

> [!faq]- LangChain으로 직접 만들면 되지 않나요?
> 만들 수 있습니다. 다만 색인, 화면이나 명령줄, 출처 표시를 직접 붙여야 하고, 한글 파일 변환과 카톡, 메일 수집도 따로 만들어야 합니다. 이 글의 네 도구는 색인, 화면이나 명령줄, 출처 표시를 갖춘 완성품입니다. 한글 파일과 카톡 연결은 그중 AutoRAG Agent만 갖췄습니다.

> [!faq]- NotebookLM 대신 쓸 수 있나요?
> 쓰는 방식이 다릅니다. NotebookLM(지금 이름은 Gemini Notebook)은 파일을 구글에 올려 노트북 단위로 묻는 서비스입니다. 이 글의 네 도구는 내 컴퓨터나 서버에 설치해 씁니다. 자료를 밖에 올리지 않아야 하거나 한글 파일, 카톡을 함께 찾아야 하면 설치형 도구가 맞습니다. 이번 비교에서는 답하는 모델로 OpenAI를 썼기 때문에, 찾은 발췌는 OpenAI로 전달됐습니다. 밖으로 보내면 안 되는 자료는 로컬 모델을 붙이면 됩니다.

> [!faq]- Open WebUI에 다른 문서 변환 엔진을 붙이면 한글 파일을 읽나요?
> Open WebUI는 Tika, Docling 같은 외부 변환 엔진을 붙일 수 있습니다. 이번에는 기본 엔진만 썼고 외부 엔진은 시험하지 않았습니다.

> [!faq]- Open WebUI에서 gpt-6 모델이 "Function tools with reasoning_effort" 오류를 내요
> 채팅 화면에서 `gpt-6` 계열 모델로 물으면 아래 오류가 납니다. 채팅 오른쪽 위 Controls의 Advanced Params에서 Reasoning Effort를 `none`으로 바꾸면 답이 나옵니다(0.11.4에서 확인).
>
> ```text wrap
> Function tools with reasoning_effort are not supported for gpt-6-luna in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'.
> ```

> [!faq]- AutoRAG Agent는 윈도우에서도 되나요?
> 본체는 맥, 윈도우, 리눅스에서 씁니다. 카카오톡 연결만 Apple Silicon 맥에서 됩니다.

## 참고 자료

**비교한 도구**

- [AnythingLLM 저장소](https://github.com/Mintplex-Labs/anything-llm), [문서](https://docs.anythingllm.com/)
- [Open WebUI 저장소](https://github.com/open-webui/open-webui), [문서](https://docs.openwebui.com/)
- [Dify 저장소](https://github.com/langgenius/dify), [문서](https://docs.dify.ai/)
- [AutoRAG 저장소](https://github.com/Marker-Inc-Korea/AutoRAG), [@autorag/librarian npm 패키지](https://www.npmjs.com/package/@autorag/librarian)

**AutoRAG Agent 수정 PR**

- [#1741 에이전트에 시스템 지시와 도구 목록 전달](https://github.com/Marker-Inc-Korea/AutoRAG/pull/1741)
- [#1754 첫 검색에 연결된 소스 포함](https://github.com/Marker-Inc-Korea/AutoRAG/pull/1754)
- [#1755 모델 요청 오류 원문 표시](https://github.com/Marker-Inc-Korea/AutoRAG/pull/1755)

**시험에 쓴 공공 한글 파일 (공공누리 제1유형)**

- 대전광역시, [대전시, 2026년 수소전기자동차 구매 보조금 지원](https://www.daejeon.go.kr/drh/board/boardNormalView.do?boardId=normal_0189&menuSeq=1632&ntatcSeq=1505811133)
- 농림축산식품부, [「농업기계 검정기준」 고시 일부개정(안) 행정예고 첨부 규제영향분석서](https://www.mafra.go.kr/bbs/home/788/578162/artclView.do)
- 용인시, [2026년 용인경전철 서포터즈 모집 지원 신청서](https://www.yongin.go.kr/user/bbs/BD_selectBbs.do?q_bbsCode=1001&q_bbscttSn=20260313103445767&q_clCode=1)
- 전라남도교육청 영암도서관, [인형극으로 여는 장애인 맞춤 독서문화](https://www.jnedu.kr/news/articleView.html?idxno=113536)
- 행정안전부, [윤호중 행안부 장관, 국정자원관리원 대전 본원 현장점검](https://www.mois.go.kr/frt/bbs/type010/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000008&nttId=129839)
- 경기도, [아프리카돼지열병(ASF) 방역대책추진현황 260922 18시기준](https://gnews.gg.go.kr/briefing/brief_gongbo_view.do?BS_CODE=S017&number=71565&subject_Code=BO01)

**갱신 이력**

- 2026-10-01 최초 발행

---

이 글은 AI의 도움을 받아 작성했습니다. 화면과 수치는 직접 실행한 결과에서 옮겼고, 설명 그림은 그 결과를 바탕으로 그렸습니다. AutoRAG Agent는 저희 NomaDamas를 운영하는 Markr의 프로젝트입니다.
