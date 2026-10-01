---
title: "PPT 만들어주는 AI, Claude Code로 쓰는 무료 오픈소스 slides-grab: 고칠 곳만 드래그해 수정"
description: "slides-grab은 Claude Code와 Codex로 PPT를 만들고, 드래그한 곳만 AI가 고치게 하는 무료 오픈소스입니다. 주간 보고 PPT 자동화를 직접 해 보고 Gamma, Genspark와 비교했습니다."
pubDatetime: 2026-10-01T17:10:00+09:00
author: "안승원 (Aiden)"
tags: ["slides-grab", "PPT AI", "AI PPT", "PPT 자동화", "claude code", "codex", "오픈소스"]
ogImage: ../../assets/images/slides-grab-ppt-ai/00-cover.png
featured: true
---
![slides-grab 편집기 화면. 왼쪽에 slides-grab 제목 슬라이드가 떠 있고 부제 Easy way to edit slides가 선택되어 있으며, 오른쪽 패널에서 선택한 글자의 내용, 색, 크기, 굵기, 정렬을 고칠 수 있다](@/assets/images/slides-grab-ppt-ai/00-slides-grab-demo.png)
*[slides-grab 저장소](https://github.com/NomaDamas/slides-grab) README의 데모 영상 한 장면입니다.*

> **요약**
>
> 1. [slides-grab](https://github.com/NomaDamas/slides-grab)은 Claude Code나 Codex 같은 AI 코딩 에이전트가 PPT를 만들게 해 주는 MIT 오픈소스입니다. 슬라이드는 내 컴퓨터에 웹페이지 형식(HTML) 파일로 생기고, 브라우저 편집기에서 고칠 곳을 드래그하면 그 영역만 AI가 고칩니다. 도구는 무료이고, AI 사용량은 쓰는 Claude Code나 Codex 요금제에서 나갑니다.
> 2. CSV 파일 하나와 메모 하나를 주고 "주간 업무 보고 PPT를 만들어 줘"라고 부탁했더니, 구성안과 스타일을 먼저 묻고 차트가 든 6장짜리 PPT를 만들었습니다. 수치는 모두 원자료와 맞았습니다.
> 3. 과장된 제목 한 줄을 드래그해 고쳐 달라고 하자 57초 뒤 6장 전체에서 그 한 줄만 바뀌었습니다.
> 4. PDF와 PPTX로 내보낼 수 있지만 PPTX는 README에 실험 기능으로 적혀 있습니다. 기본 PPTX는 슬라이드마다 이미지 한 장이라 PowerPoint에서 글자를 고칠 수 없습니다. 보고용 최종 파일은 PDF가 안전합니다.
> 5. [Gamma](https://gamma.app), [Genspark](https://www.genspark.ai)와의 비교표는 "Gamma, Genspark와 무엇이 다른가" 절에 있습니다.

## 목차

## AI로 만든 PPT, 고칠 때 막히는 곳

AI에게 PPT를 만들어 달라고 하면 초안은 금방 나옵니다. 막히는 건 그다음입니다. 3장 제목 한 줄만 바꾸고 싶은데 다시 만들면 멀쩡하던 다른 장까지 바뀌고, 말로 "세 번째 장 위쪽 제목"이라고 설명하면 엉뚱한 곳을 고치기도 합니다.

그래서 PPT 만들어주는 AI 서비스들은 고칠 곳을 가리키는 기능을 넣고 있습니다. [Gamma](https://gamma.app)는 Gamma 5(공개 베타)에서 요소를 클릭해 AI로 고치는 편집 모드를 내놨고, [Genspark](https://www.genspark.ai)는 슬라이드에 표시를 그려 수정 요청을 모아 보내는 Draw 모드가 있습니다.

slides-grab은 Claude Code나 Codex로 PPT를 만들고, 드래그한 영역만 고치게 해 주는 무료 MIT 오픈소스입니다. 결과물은 웹 서비스 안이 아니라 내 컴퓨터의 파일로 남습니다.

## slides-grab이란?

slides-grab은 AI 코딩 에이전트용 발표 자료 도구입니다. 에이전트가 따라 할 작업 절차(스킬), 명령어 도구, 브라우저 편집기로 이루어져 있습니다. 한 번 설치하면 에이전트는 네 단계로 PPT를 만듭니다.

1. **구성(Plan)**: 주제나 자료를 읽고 슬라이드 구성안을 씁니다.
2. **디자인(Design)**: 슬라이드마다 HTML 파일 하나(`slide-01.html` ...)를 만듭니다. 웹페이지와 같은 형식이라 브라우저로 열어 볼 수 있습니다.
3. **편집(Edit)**: 브라우저 편집기에서 영역을 드래그하고 수정 요청을 적으면 AI가 그 부분만 고칩니다. 글자, 색, 크기는 손으로 고칠 수도 있습니다.
4. **내보내기(Export)**: PDF, PPTX, Figma 가져오기용 PPTX, PNG로 내보냅니다.

NomaDamas 리더 김동규([@vkehfdl1](https://github.com/vkehfdl1))가 만들어 2026년 3월에 공개했고, Builder Josh의 [ppt_team_agent](https://github.com/uxjoseph/ppt_team_agent)를 바탕으로 합니다.

| 항목 | 값 |
|---|---|
| GitHub star | 1,212 |
| fork | 134 |
| 기여자 | 6명 |
| 최신 버전 | 1.5.2 (2026-09-06, npm `slides-grab`) |
| 지원 에이전트 | Claude Code, Codex |
| 라이선스 | MIT |

## Claude Code로 PPT 만들기

직접 해 봤습니다. 시연은 가상 회사의 주간 업무 보고로 했습니다. 어떤 자료를 줬는지 먼저 보면 결과를 원자료와 맞춰 볼 수 있습니다.

![시연 상황 그림. 가상 회사 한빛랩스 고객지원팀장에게 올릴 9월 5주차 보고. 왼쪽 weekly-support.csv 표에는 9월 1주부터 5주까지 접수 문의, 해결, 첫 응답(분), 만족도가 있고 3주(530건, 57분, 3.8)는 주황, 5주(471건, 466건, 29분, 4.4)는 초록으로 칠해져 있다. 오른쪽 notes.md에는 3주차 급증은 결제 오류 공지 지연 탓, 5주차 FAQ 자동 답변 도입 후 첫 응답 29분, 자동 답변 처리 138건(전체의 29%), 환불 문의는 평균 1.8일, 다음 주 계획이 적혀 있다. 아래에 Claude Code에 보낸 부탁 문장이 있다](@/assets/images/slides-grab-ppt-ai/02-scenario.png)
*회사, 인물, 수치는 모두 시연용으로 만든 가상 데이터입니다.*

### 1. 설치

명령어가 처음이라면 Claude Code에 README의 설치 안내 한 줄을 붙여 넣고 설치를 맡길 수 있습니다.

```text wrap
Read https://raw.githubusercontent.com/NomaDamas/slides-grab/main/docs/installation/claude.md and follow every step.
```

이 안내는 스킬을 `--scope user`로 설치하므로 모든 폴더의 Claude Code에서 slides-grab을 쓸 수 있게 됩니다.

PPT를 만들 폴더에서만 쓰려면 터미널(명령을 입력하는 창)에서 다음 명령을 실행합니다. Node.js 20 이상이 필요합니다.

```bash
npm install slides-grab
npx playwright install chromium
npx slides-grab install-skills --target claude-code --scope project
```

두 번째 줄은 슬라이드를 그리고 캡처할 브라우저(Chromium)를 받습니다. 세 번째 줄은 slides-grab 스킬 7개를 이 폴더의 `.claude/skills/`에 넣습니다. 이 글의 시연은 이 방식으로 설치했습니다.

### 2. 부탁 한 줄로 PPT 만들기

설치한 폴더에서 Claude Code를 열고 평소 말로 부탁했습니다.

```text wrap
data 폴더의 weekly-support.csv와 notes.md로 팀장님께 보고할 주간 업무 보고 PPT를 만들어 줘. slides-grab으로 6장 정도, 깔끔한 비즈니스 스타일로.
```

Claude Code는 slides-grab 스킬을 불러와 자료를 읽은 뒤, 만들기 전에 6장 구성안과 스타일 네 가지를 제시하며 골라 달라고 했습니다.

![Claude Code 화면. 주간 업무 보고 부탁 아래 Skill(slides-grab)이 불려 왔고, 스타일 질문에 1 표지, 2 핵심 요약, 3 5주간 지표 추이 차트, 4 3주차 급증 원인과 5주차 개선, 5 남은 이슈 환불, 6 다음 주 계획이라는 구성안이 적힌 줄에 6장 구성안을 먼저 제시라는 초록 라벨이 있다. 아래 선택지 Executive Minimal (Recommended), Corporate Blue, Swiss International, 컨설팅 정밀그리드 중 첫 번째에 스타일은 사람이 고름이라는 초록 라벨이 붙어 있다](@/assets/images/slides-grab-ppt-ai/03-style-question.png)
*2026-09-30 캡처, Claude Code 2.1.285(Opus 5.5), slides-grab 1.5.2.*

추천안(Executive Minimal)을 고르자 37초 뒤에 슬라이드별 핵심 내용을 정리한 구성안을 보여 주고 디자인으로 넘어가도 되는지 물었습니다.

![Claude Code의 구성안 표. 수치는 CSV와 메모에 있는 값과 그 값으로 계산한 것(해결률, 전주 대비 증감)만 사용했다는 문장에 원자료 값과 계산값만 사용이라는 초록 라벨이 있다. 표에는 1 표지, 2 핵심 요약 KPI 4개 접수 471건(-5.4%) 해결률 98.9% 첫 응답 29분(-15분) 만족도 4.4, 3 5주간 추이, 4 급증 원인과 개선, 5 남은 이슈, 6 다음 주 계획이 있고, 끝의 이 구성으로 디자인 단계를 진행해도 될까요 문장에 디자인 전에 확인을 받음이라는 주황 라벨이 붙어 있다](@/assets/images/slides-grab-ppt-ai/04-outline.png)
*2026-09-30 캡처, slides-grab 1.5.2. 구성안은 `decks/weekly-support-w5/slide-outline.md` 파일로도 남습니다.*

계산값을 원자료와 맞춰 봤습니다. 접수 471건은 전주 498건보다 5.4% 적고, 해결률은 466/471로 98.9%, 첫 응답은 44분에서 29분으로 15분 줄었습니다. 모두 맞습니다.

"이대로 진행해 줘"라고 답하자 디자인, 검토, 내보내기까지 12분 47초가 걸렸습니다(화면 표시 기준). 그 사이 Claude Code는 slides-grab 스킬의 지시에 따라 검토용 에이전트 두 개를 따로 띄워 슬라이드를 검토받았습니다. 1차 검토에서 두 가지가 걸려 스스로 고쳤습니다.

- 6장 제목에 메모에 없는 주장("야간 대응 공백")이 들어가 있었습니다.
- 3장 차트 글자가 최소 크기 10pt보다 작았습니다.

2차 검토는 둘 다 통과했습니다. 고치지 않은 작은 지적 4건은 `design-debt.md` 파일에 남겼습니다. 완성된 PPT는 이렇습니다.

<object data="/files/slides-grab-ppt-ai/weekly-support-w5.pdf#navpanes=0&view=FitH" type="application/pdf" width="100%" height="480" aria-label="slides-grab으로 만든 주간 업무 보고 PDF 6쪽">
  <p><a href="/files/slides-grab-ppt-ai/weekly-support-w5.pdf">주간 업무 보고 PDF 열기(6쪽)</a></p>
</object>

*slides-grab으로 만든 PDF입니다. 스크롤해서 6쪽을 모두 볼 수 있고, 화면에 보이지 않으면 [PDF 파일](/files/slides-grab-ppt-ai/weekly-support-w5.pdf)을 열면 됩니다. 3장 제목은 다음 절에서 고친 뒤의 모습입니다.*

### 3. 고칠 곳만 드래그해서 수정하기

그런데 3장 제목 "5주차에 두 지표 모두 회복했습니다"는 과장입니다. 5주차 문의 471건은 3주차보다 줄었지만 1~2주차(412건, 455건)보다는 아직 많습니다. 검토 에이전트도 이 표현을 작은 지적으로 남겼습니다.

터미널에서 편집기를 엽니다.

```bash
npx slides-grab edit --slides-dir decks/weekly-support-w5
```

브라우저에 편집기가 뜨면 3장으로 가서 제목 두 줄을 드래그로 감싸고, 오른쪽 입력창에 고칠 내용을 적습니다. 고칠 때 쓸 AI 모델도 여기서 고를 수 있습니다.

![slides-grab 편집기. 3/6장 차트 슬라이드의 제목 두 줄이 빨간 박스 1번으로 감싸져 있고, 오른쪽 Prompt 칸에 5주차 문의 471건은 1~2주차보다 아직 많아서 두 지표 모두 회복은 과장이야, 3주차 정점 대비 개선됐다는 사실만 말하도록 제목을 고쳐 줘라는 요청이, Model 칸에 claude-opus-4-8이 선택되어 있다. 아래 Run HTML Edit 버튼이 있다](@/assets/images/slides-grab-ppt-ai/06-editor-bbox.png)
*2026-10-01 캡처, slides-grab 1.5.2 편집기. 빨간 박스가 고칠 영역이고, 박스를 여러 개 그려 한 번에 보낼 수도 있습니다.*

```text wrap
5주차 문의 471건은 1~2주차보다 아직 많아서 "두 지표 모두 회복"은 과장이야. 3주차 정점 대비 개선됐다는 사실만 말하도록 제목을 고쳐 줘.
```

`Run HTML Edit`를 누르고 57초 뒤에 수정이 끝났습니다. 편집기는 고친 영역을 초록 박스로 바꾸고, 결과를 받아들일지(`Check`) 다시 시킬지(`Rerun`) 고르게 합니다.

![수정이 끝난 편집기. 상단 상태가 SUCCESS이고, 3장 제목 둘째 줄이 5주차에 정점 대비 두 지표 모두 개선됐습니다로 바뀌었으며 제목 영역이 초록 박스로 표시되고 그 위에 Check와 Rerun 버튼이 있다. 차트와 표는 그대로다](@/assets/images/slides-grab-ppt-ai/07-editor-done.png)
*2026-10-01 캡처, slides-grab 1.5.2 편집기. 편집기가 고를 수 있는 Claude 모델은 `claude-opus-4-8`, `claude-sonnet-4-6` 두 개라 앞의 것을 골랐습니다.*

![3장 제목 수정 전후. 위 빨간 줄 아래는 수정 전 5주차에 두 지표 모두 회복했습니다, 아래 초록 줄 아래는 수정 후 5주차에 정점 대비 두 지표 모두 개선됐습니다](@/assets/images/slides-grab-ppt-ai/08-before-after.png)
*위는 수정 전, 아래는 수정 후입니다. 2026-10-01, slides-grab 1.5.2.*

슬라이드가 파일이라 고치기 전과 후를 줄 단위로 비교할 수 있습니다. 6장 전체에서 바뀐 곳은 `slide-03.html`의 제목 한 줄이었습니다.

```diff
- 3주차에 문의 급증과 응답 지연이 겹쳤고,<br>5주차에 두 지표 모두 회복했습니다
+ 3주차에 문의 급증과 응답 지연이 겹쳤고,<br>5주차에 정점 대비 두 지표 모두 개선됐습니다
```

### 4. PDF, PPTX로 내보내기

고친 뒤 PDF를 내보내려고 하면 막힙니다.

```text
[slides-grab] PDF export blocked: design gate is stale because slides changed: slide-03.html.
```

slides-grab은 마지막 검토 뒤에 슬라이드가 바뀌면 PDF, PPTX 내보내기를 막습니다. 검토를 거치지 않은 수정본이 나가지 않게 하려는 장치입니다. Claude Code에 이렇게 부탁했습니다.

```text wrap
편집기에서 3장 제목을 고쳤어. 바뀐 슬라이드 다시 검토받고 PDF랑 PPTX로 다시 내보내 줘.
```

검토를 다시 받고 두 파일을 새로 만드는 데 2분 58초가 걸렸습니다.

![Claude Code의 답. 검토 결과 새 비평 에이전트 두 개가 다시 검토했고 둘 다 PASS(Critical 0건)라는 줄에 수정 뒤 검토를 다시 받음이라는 초록 라벨이 있다. 새 제목이 CSV와 맞는다는 설명, weekly-support-w5.pdf 6페이지, weekly-support-w5.pptx는 슬라이드마다 이미지 한 장이라 PowerPoint에서 글자를 고칠 수 없다는 설명이 있고, 아래 글자를 고칠 수 있는 PPTX는 변환기가 푸터 여백 규칙으로 거부한다는 줄에 편집 가능한 PPTX는 실패라는 빨간 라벨이 붙어 있다](@/assets/images/slides-grab-ppt-ai/09-reexport.png)
*2026-10-01 캡처, Claude Code 2.1.285(Opus 5.5), slides-grab 1.5.2.*

만든 PPTX는 PowerPoint에서 6장 모두 열렸습니다.

![PowerPoint에서 연 weekly-support-w5.pptx. 왼쪽 썸네일에 6장이 있고 3장에 고친 제목이 보이며, 가운데에 검은 표지 슬라이드가 크게 떠 있다](@/assets/images/slides-grab-ppt-ai/10-powerpoint.png)
*2026-10-01 캡처, PowerPoint for Mac. 창 위쪽 메뉴와 라이선스 안내는 잘라냈습니다.*

## Gamma, Genspark와 무엇이 다른가

PPT 만들어주는 AI 서비스 [Gamma](https://gamma.app), [Genspark](https://www.genspark.ai)의 무료 플랜과 비교했습니다. 두 서비스의 값은 공식 도움말에서 확인했습니다.

| 항목 | slides-grab | [Gamma](https://gamma.app) 무료 플랜 | [Genspark](https://www.genspark.ai) 무료 플랜 |
|---|---|---|---|
| 도구 비용 | 없음(MIT 오픈소스) | 가입할 때 400크레딧, 다시 채워지지 않음 | 하루 100크레딧(평생 무료 한도 안에서) |
| AI 비용 | 쓰는 에이전트(Claude Code, Codex)의 요금제 사용량 | 크레딧 | 크레딧 |
| PDF, PPTX 받기 | 됨. PPTX는 실험 기능이고 기본은 슬라이드마다 이미지 한 장 | 됨. "Made by Gamma" 배지가 붙음 | 안 됨(유료 플랜 전용) |
| 부분 수정 | 편집기에서 영역을 드래그하고 요청 | AI 편집 모드(Gamma 5 공개 베타)에서 요소를 클릭하고 요청 | Select 모드(요소 클릭), Draw 모드(표시를 그려 모아 보내기) |
| 결과물 | 내 컴퓨터의 HTML 파일 | Gamma 웹 서비스 안의 문서 | Genspark 웹 서비스 안의 문서 |

![Genspark AI Slides 편집기 화면. 왼쪽에 슬라이드 썸네일 목록, 가운데 위에 Select, Draw, Edit, Verify content, Fix Layout, Polish Content 도구 막대가 있고, The new editor is here라는 안내 상자 아래로 Introducing AI Workspace 6.0 슬라이드가 떠 있다](@/assets/images/slides-grab-ppt-ai/11-genspark-editor.png)
*Genspark AI Slides 편집기. 위쪽 도구 막대의 Select, Draw로 고칠 곳을 고를 수 있습니다. 출처: [Genspark 도움말](https://www.genspark.ai/helpcenter/ai-slides)*

고칠 곳을 가리켜 부분 수정하는 기능은 세 도구에 모두 있습니다. 차이는 세 가지입니다.

- 슬라이드가 파일로 남습니다. `slide-01.html` 같은 파일이라 고친 곳을 줄 단위로 비교하고, 예전 버전으로 되돌릴 수 있습니다.
- 이미 쓰는 에이전트가 만들고 고칩니다. 새 서비스에 가입하거나 크레딧을 따로 사지 않아도 됩니다. 대신 Claude Code나 Codex 요금제의 사용량을 씁니다.
- 자료를 폴더째 줄 수 있습니다. 이번처럼 CSV와 메모를 폴더에 두고 "이걸로 만들어 줘"라고 하면 에이전트가 읽고 계산합니다.

반대로 Gamma, Genspark는 설치 없이 웹에서 시작할 수 있고, Gamma는 무료 플랜에서도 PPTX를 받을 수 있습니다. 명령어 설치가 부담스럽다면 이쪽이 더 쉽습니다.

## 어디까지 되나

- **디자인 스타일 95개**: `slides-grab list-styles`로 목록을, `slides-grab preview-styles`로 미리보기 갤러리를 볼 수 있습니다. 기본으로 고를 수 있는 것은 92개입니다.
- **회사 템플릿 따라 하기**: `slides-grab import-template`에 기존 회사 PPTX나 HTML 화면을 주면 색, 글꼴, 배치를 뽑아 새 PPT의 기준으로 씁니다. README는 빈 마스터 템플릿보다 내용이 채워진 PPT를 주라고 권합니다.
- **카드뉴스**: `--mode card-news`로 인스타그램용 정사각형(720pt x 720pt) 슬라이드를 만들고, `slides-grab png --slide-mode card-news`로 PNG를 받을 수 있습니다.
- **이미지 생성**: `slides-grab image --prompt "..."`로 슬라이드에 넣을 이미지를 만듭니다. 기본값은 로컬 Codex 로그인(이미지 생성 권한이 있는 ChatGPT 계정)을 쓰는데, README는 비공식 경로라 예고 없이 막힐 수 있다고 경고합니다. OpenAI나 Google API 키로 바꿀 수 있습니다.
- **예시 PPT**: [쇼케이스 갤러리](https://nomadamas.github.io/slides-grab/)에서 slides-grab으로 만든 발표 자료 18개를 넘겨 볼 수 있습니다.

## 쓰기 전에 알아둘 점

### PPTX는 실험 기능입니다

README는 `convert`(PPTX)와 `figma` 내보내기를 "experimental / unstable"로 표시합니다. 이번 시연에서 확인한 것은 이렇습니다.

- 기본 PPTX(`--engine raster`)는 슬라이드마다 이미지 한 장입니다. 보기에는 HTML과 같지만 PowerPoint에서 글자를 고칠 수 없습니다.
- 글자를 살리는 방식(`--engine text`)은 이번 PPT에서 "페이지 번호와 출처가 아래 가장자리에서 0.5인치 이상 떨어져 있어야 한다"는 규칙에 걸려 변환이 거부됐습니다.

보고나 배포용 최종 파일은 PDF(`slides-grab pdf`)가 가장 안정적입니다. 기본값은 화면을 캡처해 담는 방식이고, 글자 검색이 되는 PDF가 필요하면 `--mode print`를 쓰면 됩니다.

### 편집기에서 Codex 모델을 고르면 확인 없이 명령을 실행합니다

편집기의 모델 목록에는 Codex 모델 4개(`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-6-astra`)와 Claude 모델 2개(`claude-opus-4-8`, `claude-sonnet-4-6`)가 있습니다(1.5.2 기준). 고른 모델에 따라 AI가 받는 권한이 다릅니다.

- **Codex 모델**: `codex --dangerously-bypass-approvals-and-sandbox exec`로 실행됩니다. 명령을 실행하기 전에 허락을 묻지 않고, 폴더 밖 접근을 막는 보호 장치(샌드박스)도 끈 채 실행됩니다.
- **Claude 모델**: `claude -p --permission-mode acceptEdits`로 실행됩니다. 파일 편집만 자동으로 허용합니다.

편집기는 AI에게 요청한 슬라이드 파일만 고치라고 지시합니다. 하지만 지시일 뿐 다른 파일을 건드리지 못하게 막는 장치는 아닙니다. 중요한 파일이 있는 폴더에서는 Claude 모델을 고르거나 PPT 전용 폴더를 따로 두는 편이 안전합니다.

### 수정하면 검토를 다시 받아야 내보낼 수 있습니다

편집기로 한 글자만 고쳐도 PDF, PPTX 내보내기가 막힙니다. 에이전트에게 다시 검토받고 내보내 달라고 부탁하면 됩니다.

## 시작하기

- **저장소**: [github.com/NomaDamas/slides-grab](https://github.com/NomaDamas/slides-grab). 도움이 됐다면 star를 눌러 주세요
- **쇼케이스**: [nomadamas.github.io/slides-grab](https://nomadamas.github.io/slides-grab/)
- **설치 안내**: [Claude Code](https://github.com/NomaDamas/slides-grab/blob/main/docs/installation/claude.md), [Codex](https://github.com/NomaDamas/slides-grab/blob/main/docs/installation/codex.md)
- **버그와 제안**: [이슈](https://github.com/NomaDamas/slides-grab/issues)

## 자주 묻는 질문

> [!faq]- slides-grab은 무료인가요?
> [slides-grab](https://github.com/NomaDamas/slides-grab)은 MIT 오픈소스라 무료입니다. 슬라이드를 만들고 고치는 AI는 Claude Code나 Codex를 쓰므로 AI 사용량은 그 요금제에서 나갑니다. Claude Code는 Claude 유료 요금제나 API 키가 있어야 쓸 수 있습니다.

> [!faq]- 만든 PPT를 PowerPoint에서 고칠 수 있나요?
> 기본 PPTX는 슬라이드마다 이미지 한 장이라 글자를 고칠 수 없습니다. 글자를 살리는 `--engine text` 방식이 있지만 실험 기능이고, 이번 시연 PPT에서는 변환이 거부됐습니다. 내용 수정은 slides-grab 편집기나 에이전트에게 맡기고, PowerPoint는 발표와 전달에 쓰면 됩니다.

> [!faq]- 한글이 깨지지 않나요?
> 이번 시연의 6장은 HTML, PDF, PPTX 모두 한글이 깨지지 않았습니다. 기본 PPTX와 PDF는 브라우저가 그린 화면을 이미지로 담기 때문에 글꼴 차이로 모양이 바뀌지 않습니다.

> [!faq]- Codex에서도 쓸 수 있나요?
> 네. `npx slides-grab install-skills --target codex`로 Codex용 스킬을 설치할 수 있고, `--target all`이면 Claude Code와 Codex에 모두 설치합니다. 설치 안내는 [Codex 가이드](https://github.com/NomaDamas/slides-grab/blob/main/docs/installation/codex.md)에 있습니다.

> [!faq]- 개발을 몰라도 쓸 수 있나요?
> 설치에 명령어가 필요하지만, 설치 안내 한 줄을 Claude Code나 Codex에 붙여 넣으면 에이전트가 대신 설치합니다. 그다음부터는 평소 말로 부탁하고 브라우저 편집기에서 드래그해 고치면 됩니다.

> [!faq]- Gamma, Genspark보다 나은가요?
> 쓰는 상황에 따라 다릅니다. Claude Code나 Codex를 이미 쓰고 있고 결과물을 파일로 관리하고 싶다면 slides-grab이 맞습니다. 설치 없이 웹에서 시작하고 싶다면 [Gamma](https://gamma.app)나 [Genspark](https://www.genspark.ai)가 쉽습니다. 무료 플랜의 차이는 본문 비교표에 있습니다.

## 참고 자료

**slides-grab**

- [slides-grab GitHub 저장소](https://github.com/NomaDamas/slides-grab) - README, 명령어, 디자인 스타일 목록
- [쇼케이스 갤러리](https://nomadamas.github.io/slides-grab/) - slides-grab으로 만든 발표 자료
- [ppt_team_agent](https://github.com/uxjoseph/ppt_team_agent) - slides-grab의 바탕이 된 저장소

**비교에 쓴 공식 도움말**

- [Gamma, How do credits work in Gamma?](https://help.gamma.app/en/articles/7834324-how-do-credits-work-in-gamma) - 무료 400크레딧, 다시 채워지지 않음
- [Gamma, What's the easiest way to export my gamma?](https://help.gamma.app/en/articles/8022861-what-s-the-easiest-way-to-export-my-gamma) - PDF, PPTX 내보내기와 "Made by Gamma" 배지
- [Gamma, Can I edit my content using AI?](https://help.gamma.app/en/articles/8033284-can-i-edit-my-content-using-ai) - 요소를 골라 AI로 고치기(Gamma 5 공개 베타)
- [Genspark, AI Slides](https://www.genspark.ai/helpcenter/ai-slides) - 내보내기는 유료 플랜 전용, Select 모드와 Draw 모드
- [Genspark, Membership Plans](https://www.genspark.ai/helpcenter/membership-plans) - 무료 하루 100크레딧

**갱신 이력**

- 2026-10-01 최초 발행

---

이 글은 AI의 도움을 받아 작성했습니다. 화면은 직접 실행한 Claude Code 세션과 slides-grab 편집기를 캡처했고, 시연 데이터는 가상 회사 자료로 만들었습니다.
