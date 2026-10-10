---
title: "나노 바나나 다음은 GPT Image: Codex로 이미지 만들고 고치기"
description: "나노 바나나로 익숙해진 사진 편집과 게임 소품 만들기를 Codex에 한국어로 부탁합니다. GPT Image의 편집 순위, god-tibo-imagen으로 만든 물약과 수정 결과, 직접 쓰는 방법과 제약을 소개합니다."
pubDatetime: 2026-10-10T00:56:00+09:00
author: "안승원 (Aiden)"
tags: ["god-tibo-imagen", "codex", "코덱스 이미지 생성", "AI 이미지 생성", "python", "노마다마스"]
ogImage: ../../assets/images/god-tibo-imagen/15-cover.png
featured: false
---

증명사진의 배경을 바꾸고, 사진 속 옷을 갈아입히고, 게임에 넣을 소품을 그립니다. 나노 바나나로 익숙해진 이미지 작업에서 이제 GPT Image가 편집 순위의 선두에 섰습니다. **이런 그림도 Codex에 한국어로 부탁해 만들어 볼까요?**

![같은 인물의 모습을 유지하면서 옷과 배경을 바꾼 나노 바나나의 사진 편집 예시](@/assets/images/god-tibo-imagen/10-nano-banana.jpg)
*[Google의 나노 바나나 소개](https://blog.google/products/gemini/updated-image-editing-model/)*

이미 Codex를 쓰고 있다면 이미지 생성을 위해 다른 앱부터 켜지 않아도 됩니다. 그림을 부탁하고, 마음에 들지 않는 부분을 다시 고치고, 필요한 폴더에 저장할 수 있습니다. 이 작업을 에이전트나 내 프로그램에서 연결하는 도구가 god-tibo-imagen입니다.

## 목차

## 나노 바나나 이후, GPT Image의 편집 경쟁

이미지 생성 모델을 비교하는 Arena에서는 Google의 나노 바나나 2가 선두를 지키고 있었습니다. 그런데 2026년 4월, ‘덕테이프’라는 별명으로 불린 익명 모델들이 등장했습니다. 블라인드 비교에 참여한 사용자들 사이에서 **나노 바나나 Pro보다 결과가 좋다는 반응**이 나오면서 주목받았습니다. 당시 이 모델들은 [OpenAI의 차기 이미지 모델, GPT Image 2로 추정됐습니다](https://spoonai.me/blog/2026-04-16-openai-duct-tape-gpt-image-2-ko).

OpenAI는 4월 21일 GPT Image 2를 사용하는 [ChatGPT Images 2.0](https://openai.com/index/introducing-chatgpt-images-2-0/)을 발표했습니다. 공개 직후 GPT Image 2는 [Arena의 이미지 생성과 편집 순위에서 모두 1위](https://community.openai.com/t/introducing-gpt-image-2-available-today-in-the-api-and-codex/1379479/2)에 올랐습니다. 나노 바나나가 앞서던 이미지 경쟁에서 **OpenAI가 선두를 가져온 것입니다.**

현재 편집 경쟁에서도 GPT Image가 앞서 있습니다. 2026년 10월 7일 갱신된 [Arena 단일 이미지 편집 순위](https://arena.ai/leaderboard/image/image-edit/single-image)에서 `gpt-image-2.5-sunburst`는 1위, `gemini-nano-banana-2.1`은 6위입니다. 두 모델 모두 잠정 순위이며, 점수는 사람의 선호 평가이지 편집 정확도 백분율은 아닙니다.

![Arena 단일 이미지 편집 순위: Sunburst 1위 1524±5, flare 2위 1481±5, GPT Image 2 medium 3위 1462±3, Nano Banana 2.1 6위 1428±6. Sunburst와 flare, Nano Banana 2.1은 잠정 순위](@/assets/images/god-tibo-imagen/11-image-edit-ranking.png)
*단일 이미지 편집에서 Sunburst가 1위, Nano Banana 2.1이 6위입니다.*

그렇다면 Codex에서 그림을 만들려면 새 도구부터 설치해야 할까요? **이미 Codex 자체에 이미지 생성 기능이 있습니다.** [공식 문서](https://learn.chatgpt.com/docs/image-generation)는 ChatGPT 로그인으로 `$imagegen`을 사용해 UI 자산, 배너, 삽화, 스프라이트 시트를 만드는 방법을 안내합니다. 기본 기능은 GPT Image 2를 사용하며 일반 Codex 사용 한도에 포함됩니다.

## god-tibo-imagen은 무엇을 해 주나요?

![양피지와 금빛 장식 안에 인물이 서 있는 Saint Tibo 대표 이미지](@/assets/images/god-tibo-imagen/00-saint-tibo.png)
*[god-tibo-imagen](https://github.com/NomaDamas/god-tibo-imagen)*

https://github.com/NomaDamas/god-tibo-imagen

[god-tibo-imagen](https://github.com/NomaDamas/god-tibo-imagen)은 NomaDamas 멤버 [김동규(Jeffrey Kim)](https://github.com/vkehfdl1)가 만든 공개 도구입니다. 기존 Codex의 ChatGPT 로그인 상태를 이용해 이미지 생성과 수정을 요청하고, 지정한 경로에 PNG로 저장합니다.

Claude Code나 Codex에 이 도구를 써 달라고 맡길 수 있습니다. 직접 연결하려면 터미널 명령 `gti`, Node.js의 `createProvider`, Python의 `gti.Client`를 사용합니다. 터미널은 명령을 입력하는 창입니다. 예를 들어 게임 소품을 만드는 프로그램에서 이미지 요청과 파일 저장을 한 단계로 묶을 수 있습니다.

그림 한 장을 대화로 다듬는 데는 Codex의 기본 기능으로도 충분합니다. god-tibo-imagen은 **내 프로그램에서 요청 문장과 저장 경로를 직접 다루고 싶을 때** 살펴볼 도구입니다.

## 에이전트에게 물약을 부탁했습니다

Codex에 god-tibo-imagen으로 빨간 체력 물약을 만들고, 그 PNG를 입력으로 받아 액체를 파란색으로 바꿔 달라고 부탁했습니다. 게임 가방에 넣을 소품을 떠올리며 둥근 병, 코르크 마개, 짙은 갈색 테두리와 크림색 배경을 요청했습니다.

![코르크 마개와 짙은 갈색 테두리가 있는 빨간 체력 물약과 파란 액체로 수정한 물약이 나란히 놓인 그림](@/assets/images/god-tibo-imagen/12-potion-pair.png)
*빨간 체력 물약을 만든 뒤, 같은 병의 액체를 파란색으로 바꿨습니다.*

두 결과 모두 둥근 병과 코르크 마개, 크림색 배경을 갖췄습니다. 파란 물약은 병을 처음부터 다시 설명해 만드는 대신 빨간 물약 파일을 넣어 수정한 결과입니다. 다만 ‘액체만 바꿔 달라’는 요청이 다른 모든 픽셀의 보존을 보장하지는 않습니다. 게임에 넣기 전에는 병의 윤곽과 반사광도 살펴봐야 합니다.

만든 물약의 색을 다시 바꿔 보는 과정입니다. 이번에는 빨간 병의 액체를 초록색으로 부탁합니다. 아래 영상에서 Codex와 나눈 대화와 실행 과정을 볼 수 있습니다.

<video src='/videos/god-tibo-imagen/agent-edit.mp4' poster='/videos/god-tibo-imagen/agent-edit.jpg' controls muted playsinline preload='metadata' width='100%' aria-label='Codex에 빨간 물약의 액체를 초록색으로 바꿔 달라고 부탁하는 과정'></video>

*부탁부터 결과 확인까지 약 85초. 대기 구간은 4배속입니다.*

![빨간 물약을 입력으로 받아 액체를 초록색으로 바꾼 게임 소품](@/assets/images/god-tibo-imagen/14-potion-green.png)
*같은 물약의 액체를 초록색으로 바꾼 결과입니다.*

## 직접 써 보기

### 먼저 한국어로 부탁합니다

Codex에 ChatGPT 계정으로 로그인한 환경에서, 작업 폴더를 Claude Code나 Codex로 열고 다음처럼 부탁합니다. 앞의 빨간 물약과 파란 물약처럼 생성한 파일을 다음 편집의 입력으로 연결하는 요청입니다.

```text wrap
이 폴더에 god-tibo-imagen을 설치하고 빨간 체력 물약을 그려 주세요. 둥근 유리병과 코르크 마개, 짙은 갈색 테두리, 크림색 배경의 2D 게임 소품으로 만들고 images/potion-red.png에 저장해 주세요. 다음에는 그 파일을 입력으로 넣어 병 모양과 구도를 유지하면서 액체만 파란색으로 바꾸고 images/potion-blue.png에 저장해 주세요.
```

![에이전트에게 한국어로 물약 생성과 수정을 부탁하는 방법과 터미널에서 gti 명령을 실행하는 방법을 비교한 그림](@/assets/images/god-tibo-imagen/13-how-to-ask.png)
*한국어로 부탁하거나, 직접 명령으로 물약 PNG를 저장합니다.*

에이전트가 실행 권한을 물으면 **현재 폴더에 패키지를 설치하는지, 요청과 입력 이미지를 OpenAI로 보내도 되는지** 확인한 뒤 승인하면 됩니다. 이미지 생성은 내 컴퓨터 안에서 이루어지지 않습니다. 고객 자료나 인물 사진은 전송할 권한이 있는 것만 사용합니다.

API 키는 프로그램이 다른 서비스를 이용할 때 쓰는 인증키입니다. god-tibo-imagen은 기존 Codex 로그인을 이용하므로 별도 이미지 API 키를 준비하거나 전역 설치를 하지 않아도 됩니다.

### 터미널에서 직접 실행합니다

CLI와 Node.js에는 Node.js 20 이상이 필요합니다. `pnpm`이 설치된 환경이라면 작업 폴더에서 다음 명령으로 설치합니다.

```bash
pnpm add god-tibo-imagen@0.4.1 --ignore-scripts
```

`--output`은 저장할 PNG 경로, `--size`는 요청할 크기입니다.

```bash
pnpm exec gti --provider private-codex \
  --model gpt-6.1-sol \
  --size 1024x1024 \
  --prompt "둥근 유리병과 코르크 마개가 있는 빨간 체력 물약. 짙은 갈색 테두리, 크림색 배경의 2D 게임 소품. 병 전체를 가운데에 배치하고 글자와 로고는 넣지 마세요." \
  --output ./images/potion-red.png
```

수정할 때는 `--image`로 방금 저장한 파일을 넘깁니다.

```bash
pnpm exec gti --provider private-codex \
  --model gpt-6.1-sol \
  --image ./images/potion-red.png \
  --size 1024x1024 \
  --prompt "병 모양과 코르크 마개, 테두리와 배경, 구도를 유지하고 액체만 파란색으로 바꿔 주세요." \
  --output ./images/potion-blue.png
```

### Python 코드에 연결합니다

Python 3.10 이상에서 사용할 수 있습니다. `uv`로 관리하는 프로젝트라면 아래처럼 설치합니다.

```bash
uv add god-tibo-imagen==0.4.1
```

```python
from gti import Client

client = Client(provider="private-codex")
result = client.generate_image(
    prompt="둥근 유리병과 코르크 마개가 있는 빨간 체력 물약. 크림색 배경의 2D 게임 소품. 글자 없이 그려 주세요.",
    model="gpt-6.1-sol",
    output_path="./images/potion-red.png",
    size="1024x1024",
)
print(result.saved_path)
```

Node.js에서는 `createProvider`로 같은 작업을 코드에 연결합니다. 자세한 인자와 편집 예시는 [저장소 사용법](https://github.com/NomaDamas/god-tibo-imagen)을 참고합니다.

### 시작 전에 알아둘 제약

- **로그인만으로 생성 권한이 보장되지는 않습니다.** 기존 Codex의 ChatGPT 인증을 이용하며, 인증정보가 시스템 키체인에만 있는 환경은 지원하지 않습니다. 계정의 이미지 생성 권한도 필요합니다.
- **비공개 통신 경로에 의존합니다.** 서버 주소나 요청 형식이 바뀌면 작동하지 않을 수 있습니다. 계속 운영할 서비스에는 [공식 이미지 생성 API](https://developers.openai.com/api/docs/guides/image-generation)를 우선 검토합니다.
- **이미지 모델 옵션이 그대로 적용되지 않을 수 있습니다.** 기본 요청값은 Sunburst지만 비공개 서버가 그 값을 따르지 않을 수 있습니다.
- **요청한 크기와 결과 크기가 다를 수 있습니다.** 물약은 1024×1024를 요청했지만 1254×1254로 반환됐습니다. 게임에서 정확한 크기가 필요하면 저장 후 확인하고 맞춰야 합니다.
- **구독이 무제한 생성을 뜻하지는 않습니다.** Codex 기본 이미지 생성은 일반 사용 한도에 포함됩니다. 모든 구독 계정에서 무료 또는 무제한 생성이나 GPT Image 2.5 사용이 보장되는 것은 아닙니다.

## 저희 NomaDamas를 소개합니다

![NomaDamas 작업 공간에서 멤버들이 책상과 여러 대의 모니터 앞에서 작업하는 모습](@/assets/images/korea-hacker-house/00-nomadamas-workspace.jpg)
*[NomaDamas 작업 공간](/posts/korea-hacker-house/)*

[NomaDamas](https://blog.nomadamas.org/about/)는 AI 회사 [Markr AI](https://markr.ai)가 운영하는 AI 오픈소스 해커하우스입니다. 함께 살거나 작업 공간에 드나드는 멤버들이 필요한 도구를 만들고 공개합니다. 혼자 시작한 프로젝트에 다른 멤버가 붙고, 매주 화요일 저녁에는 한 주 동안 만든 것을 보여 줍니다.

god-tibo-imagen도 이곳에서 나온 도구입니다. NomaDamas는 2026년 10월 10일 기준 공개 저장소 90개를 운영하며, Markr와 함께 화장실을 주제로 제품을 만드는 해커톤 ‘변기톤’도 열었습니다. 작업 공간과 프로젝트 이야기는 [해커하우스 소개](/posts/korea-hacker-house/)에서 이어 읽을 수 있습니다.

처음에는 물약 하나를 부탁해 보고, 색이나 소재를 바꿔 보세요. 쓸 만한 도구라면 [god-tibo-imagen 저장소](https://github.com/NomaDamas/god-tibo-imagen)에 star를 눌러 주세요.

## 자주 묻는 질문

> [!faq]- Codex 이미지 생성에 이 도구가 꼭 필요한가요?
> 아닙니다. Codex에는 `$imagegen`으로 쓰는 기본 이미지 생성 기능이 있습니다. god-tibo-imagen은 별도 명령이나 Node.js/Python 코드에서 요청과 저장 경로를 다룰 때 사용할 수 있습니다.

> [!faq]- 별도 OpenAI API 키 없이 되나요?
> 기존 Codex의 ChatGPT 로그인 상태를 이용합니다. 계정의 이미지 생성 권한과 이용 조건을 확인해야 하며, API 키를 쓰지 않는다고 무제한이나 영구 무료인 것은 아닙니다.

> [!faq]- 액체만 바꾸면 병은 완전히 그대로인가요?
> 보장되지 않습니다. 물약의 색을 바꾸는 편집은 가능하지만 병의 윤곽과 반사광 등 다른 부분도 달라질 수 있습니다. 게임에 쓰기 전에는 원본과 결과를 비교합니다.

> [!faq]- Can I generate images from Python with god-tibo-imagen?
> Yes. Use `gti.Client` to request an image and save it as a PNG. It uses existing Codex ChatGPT authentication and depends on a private backend rather than the official public image API.

## 참고 자료

- [god-tibo-imagen](https://github.com/NomaDamas/god-tibo-imagen)
- [Codex 이미지 생성](https://learn.chatgpt.com/docs/image-generation)
- [GPT Image 2.5 Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst)
- [Arena 이미지 편집 순위](https://arena.ai/leaderboard/image/image-edit/single-image)

이 글은 AI의 도움을 받아 작성했습니다.
