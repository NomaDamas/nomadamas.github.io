---
title: "나노 바나나 다음은 GPT Image: Codex로 이미지 만들고 고치기"
description: "SNS 광고 시안을 만들고 제목과 버튼 문구를 바꾸는 일을 Codex에 한국어로 부탁합니다. GPT Image의 편집 경쟁, god-tibo-imagen으로 만든 실제 커피 광고 시안과 활용 방법을 소개합니다."
pubDatetime: 2026-10-10T00:56:00+09:00
author: "안승원 (Aiden)"
tags: ["god-tibo-imagen", "codex", "코덱스 이미지 생성", "AI 이미지 생성", "python", "노마다마스"]
ogImage: ../../assets/images/god-tibo-imagen/20-ad-original.png
featured: false
---

요즘 AI는 글쓰기와 개발을 넘어 디자인 작업에서도 실력을 보여 주고 있습니다. 특히 이미지 생성과 편집의 발전이 눈에 띕니다. 증명사진의 배경을 바꾸고, 사진 속 옷을 갈아입히고, SNS에 올릴 광고 소재를 만드는 일을 말로 부탁할 수 있게 됐습니다.

이런 활용으로 주목받은 도구가 Google의 나노 바나나입니다. 이제 OpenAI의 GPT Image도 이미지 생성과 편집 능력을 높이며 경쟁하고 있습니다. **이런 이미지 작업도 평소 쓰던 Codex에서 한국어로 부탁해 볼까요?**

![같은 인물의 모습을 유지하면서 옷과 배경을 바꾼 나노 바나나의 사진 편집 예시](@/assets/images/god-tibo-imagen/10-nano-banana.jpg)
*[Google의 나노 바나나 소개](https://blog.google/products/gemini/updated-image-editing-model/)*

이미 Codex를 쓰고 있다면 이미지 생성을 위해 다른 앱부터 켜지 않아도 됩니다. 그림을 부탁하고, 마음에 들지 않는 부분을 다시 고치고, 필요한 폴더에 저장할 수 있습니다. 이 작업을 에이전트나 내 프로그램에서 연결하는 도구가 god-tibo-imagen입니다.

## 목차

## 나노 바나나 이후, GPT Image의 편집 경쟁

이미지 생성 모델을 비교하는 Arena에서는 Google의 나노 바나나 2가 선두를 지키고 있었습니다. 그런데 2026년 4월, ‘덕테이프’라는 별명으로 불린 익명 모델들이 등장했습니다. 블라인드 비교에 참여한 사용자들 사이에서 **나노 바나나 Pro보다 결과가 좋다는 반응**이 나오면서 주목받았습니다. 당시 이 모델들은 [OpenAI의 차기 이미지 모델, GPT Image 2로 추정됐습니다](https://spoonai.me/blog/2026-04-16-openai-duct-tape-gpt-image-2-ko).

OpenAI는 4월 21일 GPT Image 2를 사용하는 [ChatGPT Images 2.0](https://openai.com/index/introducing-chatgpt-images-2-0/)을 발표했습니다. 공개 직후 GPT Image 2는 [Arena의 이미지 생성과 편집 순위에서 모두 1위](https://community.openai.com/t/introducing-gpt-image-2-available-today-in-the-api-and-codex/1379479/2)에 올랐습니다. 나노 바나나가 앞서던 이미지 경쟁에서 **OpenAI가 선두를 가져온 것입니다.**

현재 편집 경쟁에서도 GPT Image가 앞서 있습니다. 2026년 10월 7일 갱신된 [Arena 단일 이미지 편집 순위](https://arena.ai/leaderboard/image/image-edit/single-image)에서 `gpt-image-2.5-sunburst`는 1위, `gemini-nano-banana-2.1`은 6위입니다. 두 모델 모두 잠정 순위이며, 점수는 사람의 선호 평가이지 편집 정확도 백분율은 아닙니다.

![Arena 단일 이미지 편집 순위의 실제 화면. 상위 6개 모델 중 GPT Image가 1~3위, Nano Banana 2.1이 6위이며 점수와 잠정 평가 표시가 함께 보입니다.](@/assets/images/god-tibo-imagen/11-image-edit-ranking.png)
*[Arena 단일 이미지 편집 순위](https://arena.ai/leaderboard/image/image-edit/single-image). Sunburst가 1위, Nano Banana 2.1이 6위입니다.*

그렇다면 Codex에서 그림을 만들려면 새 도구부터 설치해야 할까요? **이미 Codex 자체에 이미지 생성 기능이 있습니다.** [공식 문서](https://learn.chatgpt.com/docs/image-generation)는 ChatGPT 로그인으로 `$imagegen`을 사용해 UI 자산, 배너, 삽화, 스프라이트 시트를 만드는 방법을 안내합니다. 기본 기능은 GPT Image 2를 사용하며 일반 Codex 사용 한도에 포함됩니다.

## god-tibo-imagen은 무엇을 해 주나요?

![양피지와 금빛 장식 안에 인물이 서 있는 Saint Tibo 대표 이미지](@/assets/images/god-tibo-imagen/00-saint-tibo.png)
*[god-tibo-imagen](https://github.com/NomaDamas/god-tibo-imagen)*

https://github.com/NomaDamas/god-tibo-imagen

[god-tibo-imagen](https://github.com/NomaDamas/god-tibo-imagen)은 NomaDamas 멤버 [김동규(Jeffrey Kim)](https://github.com/vkehfdl1)가 만든 공개 도구입니다. 기존 Codex의 ChatGPT 로그인 상태를 이용해 이미지 생성과 수정을 요청하고, 지정한 경로에 PNG로 저장합니다.

Claude Code나 Codex에 이 도구를 써 달라고 맡길 수 있습니다. 직접 연결하려면 터미널 명령 `gti`, Node.js의 `createProvider`, Python의 `gti.Client`를 사용합니다. 터미널은 명령을 입력하는 창입니다. 예를 들어 광고 문구별 시안을 만드는 프로그램에서 이미지 요청과 파일 저장을 한 단계로 묶을 수 있습니다.

그림 한 장을 대화로 다듬는 데는 Codex의 기본 기능으로도 충분합니다. god-tibo-imagen은 **내 프로그램에서 요청 문장과 저장 경로를 직접 다루고 싶을 때** 살펴볼 도구입니다.

## 광고 시안을 만들고, 문구를 바꿔 봅니다

SNS 광고를 준비하다 보면 같은 상품으로 여러 문구를 시험해 보고 싶어집니다. 제품 사진과 색감은 유지하면서 제목이나 버튼 문구를 바꾼 시안을 비교하는 작업입니다.

커피 정기배송 서비스를 가정하고 Codex에 광고 시안을 부탁했습니다. 크림색 배경에 커피 봉투와 아이스커피를 배치하고, 제목은 ‘매일, 좋은 커피’, 버튼에는 ‘커피 구독 알아보기’를 넣도록 요청했습니다.

![크림색 배경에 커피 봉투와 아이스커피를 배치한 광고. 제목은 매일, 좋은 커피, 버튼은 커피 구독 알아보기입니다.](@/assets/images/god-tibo-imagen/20-ad-original.png)
*‘매일, 좋은 커피’로 정기배송 서비스를 소개하는 시안입니다.*

다음에는 이 PNG를 입력으로 넣고 제목을 ‘출근 전, 한 잔의 여유’, 버튼 문구를 ‘첫 배송 살펴보기’로 바꿔 달라고 부탁했습니다. 상품을 다시 설명하지 않고 기존 시안에서 광고 문구를 수정한 것입니다.

![같은 커피 봉투와 아이스커피 구도를 사용한 광고. 제목은 출근 전, 한 잔의 여유, 버튼은 첫 배송 살펴보기로 바뀌었습니다.](@/assets/images/god-tibo-imagen/21-ad-variant.png)
*출근 전의 상황을 떠올리게 하는 문구로 바꾼 시안입니다.*

두 시안 모두 커피 봉투와 잔, 크림색 배경을 유지하면서 제목과 버튼 문구가 바뀌었습니다. 이렇게 후보를 만든 뒤 어떤 문구가 상품과 고객에게 더 맞는지 비교할 수 있습니다. 실제 광고를 내보내기 전에는 한글 표기와 상품 표현, 브랜드 지침을 확인하면 됩니다.

<video src='/videos/god-tibo-imagen/ad-demo.mp4' poster='/videos/god-tibo-imagen/ad-demo.jpg' controls muted playsinline preload='metadata' width='100%' aria-label='Codex에 커피 광고 시안을 부탁하고 제목과 버튼 문구를 바꾸는 실행 기록'></video>

*한국어 부탁부터 두 시안 확인까지. 대기 구간은 4배속입니다.*

## 직접 써 보기

### 먼저 한국어로 부탁합니다

Codex에 ChatGPT 계정으로 로그인한 환경에서, 작업 폴더를 Claude Code나 Codex로 열고 다음처럼 부탁합니다. 첫 광고 시안을 만들고 그 파일을 입력으로 넣어 다른 문구의 시안까지 만드는 요청입니다.

```text wrap
god-tibo-imagen으로 커피 정기배송 서비스의 SNS 광고 시안을 만들어 주세요. 크림색 배경에 커피 봉투와 아이스커피를 배치하고, 제목은 '매일, 좋은 커피', 버튼 문구는 '커피 구독 알아보기'로 넣어 images/ad-original.png에 저장해 주세요. 다음에는 이 파일을 입력으로 넣고 제품 사진과 색감은 유지하면서 제목을 '출근 전, 한 잔의 여유', 버튼 문구를 '첫 배송 살펴보기'로 바꿔 images/ad-variant.png에 저장해 주세요.
```

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
  --prompt "커피 정기배송 서비스의 SNS 광고. 크림색 배경에 커피 봉투와 아이스커피를 배치하고 짙은 초록색 글자를 사용하세요. 제목은 '매일, 좋은 커피', 작은 설명은 '커피 정기배송', 버튼 문구는 '커피 구독 알아보기'로 넣으세요. 실제 브랜드 로고와 가격은 넣지 마세요." \
  --output ./images/ad-original.png
```

수정할 때는 `--image`로 방금 저장한 파일을 넘깁니다.

```bash
pnpm exec gti --provider private-codex \
  --model gpt-6.1-sol \
  --image ./images/ad-original.png \
  --size 1024x1024 \
  --prompt "제품 사진과 색감을 유지하면서 제목을 '출근 전, 한 잔의 여유', 버튼 문구를 '첫 배송 살펴보기'로 바꿔 주세요." \
  --output ./images/ad-variant.png
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
    prompt="커피 정기배송 서비스의 SNS 광고. 크림색 배경에 커피 봉투와 아이스커피를 배치하고, 제목은 '매일, 좋은 커피', 버튼 문구는 '커피 구독 알아보기'로 넣어 주세요.",
    model="gpt-6.1-sol",
    output_path="./images/ad-original.png",
    size="1024x1024",
)
print(result.saved_path)
```

Node.js에서는 `createProvider`로 같은 작업을 코드에 연결합니다. 자세한 인자와 편집 예시는 [저장소 사용법](https://github.com/NomaDamas/god-tibo-imagen)을 참고합니다.

### 시작 전에 알아둘 제약

- **로그인만으로 생성 권한이 보장되지는 않습니다.** 기존 Codex의 ChatGPT 인증을 이용하며, 인증정보가 시스템 키체인에만 있는 환경은 지원하지 않습니다. 계정의 이미지 생성 권한도 필요합니다.
- **비공개 통신 경로에 의존합니다.** 서버 주소나 요청 형식이 바뀌면 작동하지 않을 수 있습니다. 계속 운영할 서비스에는 [공식 이미지 생성 API](https://developers.openai.com/api/docs/guides/image-generation)를 우선 검토합니다.
- **이미지 모델 옵션이 그대로 적용되지 않을 수 있습니다.** 기본 요청값은 Sunburst지만 비공개 서버가 그 값을 따르지 않을 수 있습니다.
- **요청한 크기와 결과 크기가 다를 수 있습니다.** 광고 플랫폼이 요구하는 픽셀 규격에 맞게 저장 결과를 확인하고 내보내면 됩니다.
- **구독이 무제한 생성을 뜻하지는 않습니다.** Codex 기본 이미지 생성은 일반 사용 한도에 포함됩니다. 모든 구독 계정에서 무료 또는 무제한 생성이나 GPT Image 2.5 사용이 보장되는 것은 아닙니다.

## 저희 NomaDamas를 소개합니다

![NomaDamas 작업 공간에서 멤버들이 책상과 여러 대의 모니터 앞에서 작업하는 모습](@/assets/images/korea-hacker-house/00-nomadamas-workspace.jpg)
*[NomaDamas 작업 공간](/posts/korea-hacker-house/)*

[NomaDamas](https://blog.nomadamas.org/about/)는 AI 회사 [Markr AI](https://markr.ai)가 운영하는 AI 오픈소스 해커하우스입니다. 함께 살거나 작업 공간에 드나드는 멤버들이 필요한 도구를 만들고 공개합니다. 혼자 시작한 프로젝트에 다른 멤버가 붙고, 매주 화요일 저녁에는 한 주 동안 만든 것을 보여 줍니다.

god-tibo-imagen도 이곳에서 나온 도구입니다. NomaDamas는 2026년 10월 10일 기준 공개 저장소 90개를 운영하며, Markr와 함께 화장실을 주제로 제품을 만드는 해커톤 ‘변기톤’도 열었습니다. 작업 공간과 프로젝트 이야기는 [해커하우스 소개](/posts/korea-hacker-house/)에서 이어 읽을 수 있습니다.

다음 SNS 게시물이나 광고에 쓸 시안을 하나 부탁해 보세요. 상품과 문구를 바꿔 가며 후보를 비교할 수 있습니다. 쓸 만한 도구라면 [god-tibo-imagen 저장소](https://github.com/NomaDamas/god-tibo-imagen)에 star를 눌러 주세요.

## 자주 묻는 질문

> [!faq]- Codex 이미지 생성에 이 도구가 꼭 필요한가요?
> 아닙니다. Codex에는 `$imagegen`으로 쓰는 기본 이미지 생성 기능이 있습니다. god-tibo-imagen은 별도 명령이나 Node.js/Python 코드에서 요청과 저장 경로를 다룰 때 사용할 수 있습니다.

> [!faq]- 별도 OpenAI API 키 없이 되나요?
> 기존 Codex의 ChatGPT 로그인 상태를 이용합니다. 계정의 이미지 생성 권한과 이용 조건을 확인해야 하며, API 키를 쓰지 않는다고 무제한이나 영구 무료인 것은 아닙니다.

> [!faq]- 같은 상품으로 광고 문구가 다른 시안을 만들 수 있나요?
> 기존 시안 파일을 입력으로 넣고 제목이나 버튼 문구를 바꿔 달라고 부탁하면 됩니다. 여러 후보를 비교한 뒤 실제 광고에 쓸 문구와 상품 표현을 최종 확인하면 됩니다.

> [!faq]- Can I generate images from Python with god-tibo-imagen?
> Yes. Use `gti.Client` to request an image and save it as a PNG. It uses existing Codex ChatGPT authentication and depends on a private backend rather than the official public image API.

## 참고 자료

- [god-tibo-imagen](https://github.com/NomaDamas/god-tibo-imagen)
- [Codex 이미지 생성](https://learn.chatgpt.com/docs/image-generation)
- [GPT Image 2.5 Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst)
- [Arena 이미지 편집 순위](https://arena.ai/leaderboard/image/image-edit/single-image)

이 글은 AI의 도움을 받아 작성했습니다.
