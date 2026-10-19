---
title: "로컬 TTS 모델 추천: 내 컴퓨터에서 AI 음성 만들기"
description: "로컬 TTS 모델 추천을 위해 한국어와 영어 음성을 직접 만들었습니다. Qwen3-TTS 등 local TTS 모델 5종의 음성 복제 샘플과 Apple Silicon Mac 실행 조건을 비교합니다."
pubDatetime: 2026-10-20T02:40:00+09:00
author: "안승원 (Aiden)"
tags: ["로컬 TTS", "한국어 TTS", "음성 복제", "Qwen3-TTS", "AI 음성", "local TTS"]
ogImage: ../../assets/images/local-tts-models/00-cover.png
featured: false
draft: true
---

> [!TIP] 먼저 고른다면
> - 한국어와 영어 나레이션을 내 목소리로 만들려면 **Qwen3-TTS Base**부터 권합니다. 제가 쓰는 목소리와 짧은 대본에서는 Qwen이 가장 마음에 들었습니다.
> - VoxCPM2, Higgs TTS 3, MOSS-TTS, Fish Audio Drama 3도 같은 대본으로 생성했습니다. 아래에서 다섯 모델의 두 언어 샘플을 들을 수 있습니다.
> - 직접 실행한 환경은 **Apple M5 Pro, 메모리 48GB Mac**입니다. Windows PC나 메모리가 적은 노트북의 실행 결과와는 구분해 읽어 주세요.

쇼츠 대본에서 문장 하나를 바꾸면 나레이션도 다시 녹음해야 합니다. 발표 영상이나 제품 시연을 만들 때도 비슷합니다. 대본을 고칠 때마다 내 목소리로 음성 파일을 만들 수 있다면 어떨까요?

로컬 TTS(Text-to-Speech, 문자를 음성으로 바꾸는 기술)는 모델을 내 컴퓨터에 받아 실행하는 방식입니다. 이 글은 한국어와 영어 나레이션을 만들려는 분이 첫 모델을 고를 수 있도록, 음성 복제가 가능한 다섯 모델의 결과와 실행 조건을 정리했습니다.

## 목차

## 로컬 TTS로 무엇을 할 수 있나요?

대본을 넣으면 WAV 같은 음성 파일이 나옵니다. 그 파일을 영상 편집기에 넣어 나레이션으로 쓸 수 있습니다. 모델에 따라 준비된 목소리를 고르거나, 녹음한 음성을 참고해 비슷한 목소리로 새 문장을 읽히는 음성 복제도 가능합니다.

![로컬 TTS의 입력과 결과. 새로 읽힐 대본과 목소리 참고 녹음을 내 컴퓨터의 모델에 넣으면 새 나레이션 WAV가 나온다](@/assets/images/local-tts-models/01-local-tts.png)
*이번 비교는 참고 녹음으로 목소리를 복제하는 방식입니다. 원본 녹음과 새로 읽힐 대본은 서로 다릅니다.*

아래 샘플은 모델을 내려받은 뒤 로컬에서 생성했습니다. 생성할 때 외부 TTS API를 호출하지 않았습니다. 대신 모델을 저장할 디스크 공간과 실행할 메모리가 필요합니다.

여기서 살펴볼 것은 한국어와 영어, 그리고 내 목소리 복제입니다. 감정 연기, 긴 오디오북, 실시간 대화까지 한꺼번에 평가하지는 않았습니다.

## 처음 하나 설치한다면 Qwen3-TTS

저는 한국어와 영어 나레이션용 첫 로컬 TTS로 [Qwen3-TTS](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base)를 권합니다. 원래 사용하던 모델이고, 다른 후보를 실행한 뒤에도 제 목소리로 만든 짧은 샘플에서는 Qwen을 선호했습니다. 모든 화자와 대본에서 가장 좋다는 순위표는 아닙니다.

Qwen3-TTS에는 용도가 다른 모델이 있습니다. **Base**는 녹음을 넣어 목소리를 복제할 때, **CustomVoice**는 준비된 화자를 고를 때, **VoiceDesign**은 원하는 목소리를 글로 설명할 때 쓰는 모델입니다. 한국어와 영어는 공식 지원 언어에 포함됩니다. 이 글에서 사용한 것은 **1.7B Base BF16**입니다. [공식 모델 설명](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base#released-models-description-and-download)

이름 뒤의 1.7B는 모델의 매개변수 규모, BF16은 가중치라는 모델 데이터를 저장하는 정밀도를 나타냅니다. 모델 크기와 저장 방식이 다르면 필요한 메모리와 결과도 달라질 수 있습니다.

### 같은 문장을 읽힌 Qwen 샘플

한국어 대본입니다.

> 안녕하세요. 오늘은 새로운 음성 모델을 비교합니다.

<audio controls preload="metadata" src="/audio/local-tts-models/qwen-ko.wav" aria-label="Qwen3-TTS 한국어 음성 복제 샘플" style="width:100%;max-width:100%"></audio>

영어 대본입니다. 목소리 참고 녹음은 한국어입니다.

> Hello. Today we are comparing new voice models.

<audio controls preload="metadata" src="/audio/local-tts-models/qwen-en.wav" aria-label="Qwen3-TTS 영어 음성 복제 샘플" style="width:100%;max-width:100%"></audio>

*다섯 모델에 같은 6초 녹음과 그 내용을 받아쓴 글을 넣었습니다. 비교하기 쉽도록 재생 파일의 음량을 맞추고 모두 48kHz, 한 채널(모노) WAV로 변환했습니다. 모델이 처음 만든 파일의 형식과는 다를 수 있습니다.*

## 다른 로컬 TTS 모델도 들어보면

Qwen 결과가 마음에 들더라도 다른 모델로 같은 대본을 읽혀볼 이유는 있습니다. 내 목소리와 얼마나 닮았는지, 문장 끝이 어떻게 내려가는지, 영어 발음이 어떤지는 모델 이름이나 지원 언어 수만으로 고르기 어렵습니다.

아래 네 모델에도 앞의 한국어와 영어 대본을 넣었습니다. 모델마다 내부 구조와 실행 설정이 달라서, 같은 입력을 넣었다는 것과 같은 연산 조건에서 겨뤘다는 것은 구분해야 합니다.

### VoxCPM2

[VoxCPM2](https://github.com/OpenBMB/VoxCPM)는 OpenBMB의 다국어 음성 생성 모델입니다. 공식 프로젝트는 음성 복제와 목소리 설계 기능을 소개합니다. 여기서는 BF16 가중치를 Apple Silicon용 실행기인 MLX-Audio로 돌려 두 언어를 생성했습니다.

**한국어**

<audio controls preload="metadata" src="/audio/local-tts-models/vox-ko.wav" aria-label="VoxCPM2 한국어 음성 복제 샘플" style="width:100%;max-width:100%"></audio>

**영어**

<audio controls preload="metadata" src="/audio/local-tts-models/vox-en.wav" aria-label="VoxCPM2 영어 음성 복제 샘플" style="width:100%;max-width:100%"></audio>

Qwen과 목소리의 닮은 정도나 말의 리듬이 다르게 들린다면, 실제로 쓸 대본 몇 줄을 더 넣어 볼 후보입니다.

### Higgs TTS 3

[Higgs TTS 3](https://huggingface.co/bosonai/higgs-tts-3-4b)는 Boson AI의 음성 생성 모델입니다. 이번에는 4B BF16 가중치를 MLX-Audio에서 실행했습니다.

**한국어**

<audio controls preload="metadata" src="/audio/local-tts-models/higgs-ko.wav" aria-label="Higgs TTS 3 한국어 음성 복제 샘플" style="width:100%;max-width:100%"></audio>

**영어**

<audio controls preload="metadata" src="/audio/local-tts-models/higgs-en.wav" aria-label="Higgs TTS 3 영어 음성 복제 샘플" style="width:100%;max-width:100%"></audio>

같은 문장을 읽어도 멈추는 위치나 끝음이 달라질 수 있습니다. 영상에 넣을 때는 화면에 맞는 말의 속도인지도 들어볼 수 있습니다.

### MOSS-TTS 1.5 Local Transformer

[MOSS-TTS](https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Local-Transformer-v1.5)에는 여러 구조의 모델이 있습니다. 아래 샘플은 **4B Local Transformer 4비트 모델과 v2 BF16 음성 변환기**로 만들었습니다. 음성 변환기는 모델이 다루는 수치 표현과 실제 소리를 서로 바꾸는 모듈입니다.

**한국어**

<audio controls preload="metadata" src="/audio/local-tts-models/moss-ko.wav" aria-label="MOSS-TTS Local Transformer 한국어 음성 복제 샘플" style="width:100%;max-width:100%"></audio>

**영어**

<audio controls preload="metadata" src="/audio/local-tts-models/moss-en.wav" aria-label="MOSS-TTS Local Transformer 영어 음성 복제 샘플" style="width:100%;max-width:100%"></audio>

설치할 때는 모델 구조와 함께 필요한 음성 변환기의 버전도 확인하는 편이 좋습니다. 이번 설정은 v2를 사용했습니다.

### Fish Audio Drama 3

[Fish Audio Drama 3](https://huggingface.co/fishaudio/drama-3)도 한국어와 영어 샘플을 만들었습니다. 이번에는 MLX 대신 [audio.cpp](https://github.com/0xShug0/audio.cpp/blob/main/docs/models/fish_drama3.md)를 사용했습니다. 모델 일부를 디스크에서 읽으며 CPU로 실행하는 설정입니다.

사용한 가중치는 모델 일부를 4비트, 본체를 8비트로 저장한 [Q4_K/Q8 GGUF 변환본](https://huggingface.co/Jmica/Drama-3-GGUF/blob/main/drama-3-backbone-8bit-experts-Q4_K_S.gguf)입니다. 크기는 약 **24.6GB**입니다. GGUF는 실행기에 맞춰 변환한 모델 파일 형식입니다. 아래 짧은 음성 하나에도 이 설정에서는 약 100초에서 127초가 걸렸습니다.

**한국어**

<audio controls preload="metadata" src="/audio/local-tts-models/drama-ko.wav" aria-label="Fish Audio Drama 3 한국어 음성 복제 샘플" style="width:100%;max-width:100%"></audio>

**영어**

<audio controls preload="metadata" src="/audio/local-tts-models/drama-en.wav" aria-label="Fish Audio Drama 3 영어 음성 복제 샘플" style="width:100%;max-width:100%"></audio>

이 시간은 CPU와 디스크를 이용한 이번 실행의 값입니다. 다른 네 모델의 GPU 실행 시간과 비교해 Drama 자체가 그만큼 느리다고 말할 수는 없습니다.

## 내 컴퓨터에서 돌아갈까요?

먼저 운영체제와 칩, 메모리, 남은 디스크 공간을 확인하면 됩니다. **모델 파일 크기와 실행 중 메모리 사용량은 서로 다릅니다.** 파일이 디스크에 들어가더라도 모델과 음성 변환기를 함께 불러오면 메모리가 부족할 수 있습니다.

이번 실행 환경은 M5 Pro, 메모리 48GB, macOS 26.6.2입니다. MLX는 Apple Silicon용 계산 도구이고, MLX-Audio는 이를 이용해 음성 모델을 실행하는 라이브러리입니다. MLX 변환본을 Windows에서 같은 명령으로 실행하는 방법은 이 글에서 확인하지 않았습니다.

| 실제 사용한 설정 | 한국어 생성 시간 | 영어 생성 시간 | MLX가 기록한 누적 최대 메모리 |
|---|---:|---:|---:|
| Qwen3-TTS 1.7B Base BF16 | 10.69초 | 5.82초 | 8.79GB |
| VoxCPM2 BF16 | 17.89초 | 15.24초 | 7.29GB |
| Higgs TTS 3 4B BF16 | 8.29초 | 5.86초 | 9.91GB |
| MOSS-TTS 4B Local Transformer 4비트, v2 BF16 변환기 | 8.76초 | 5.56초 | 8.32GB |

*언어마다 약 3초에서 4초 길이의 음성을 한 번씩 만들었습니다. 시간에는 참고 음성 처리와 첫 요청의 준비가 포함될 수 있습니다. Qwen은 MLX-Audio 0.4.8, 나머지 세 모델은 별도 환경의 소스 버전을 사용했습니다. 이 메모리 값은 필요한 총 시스템 메모리나 최소 사양이 아닙니다.*

Drama 3는 CPU 실행이므로 따로 보면, 한국어 127.22초, 영어 99.64초가 걸렸습니다. 생성 작업의 프로세스 묶음에서 측정한 최대 RSS는 11.80GB였습니다. RSS는 운영체제가 측정하는 프로세스 메모리여서 위 표의 MLX 값과 직접 비교할 수 없습니다.

이번 Mac에서는 MOSS 8B BF16을 실행하던 중 메모리 압박과 재시작이 발생했습니다. 직접 원인은 확정하지 못했습니다. 최종 비교에는 구조가 다른 4B Local Transformer 4비트 모델을 사용했습니다. 한 번에 모델 하나씩 실행해 열 개 샘플 생성을 마쳤습니다. 파일 크기만 보고 여러 모델을 한꺼번에 올리는 방식은 권하지 않습니다.

## Mac에서 첫 음성을 만들어 보려면

처음에는 Qwen3-TTS 하나로 짧은 문장부터 만들어 볼 수 있습니다. Apple Silicon Mac이라면 [MLX-Audio 설치 안내](https://github.com/Blaizzy/mlx-audio)를, 다른 환경이라면 [Qwen3-TTS 공식 실행 안내](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base#quickstart)를 출발점으로 삼을 수 있습니다. 공식 예제의 CUDA 설정은 NVIDIA GPU용이므로 Mac용 명령과 구분해 주세요.

아래 방법은 Apple Silicon Mac에서 Claude Code(클로드 코드)나 Codex(코덱스)를 이미 쓰는 분을 위한 시작 방법입니다. 두 도구에는 한국어로 설치와 파일 작업을 맡길 수 있습니다.

1. 배경음이나 다른 사람의 말이 겹치지 않는 본인 녹음을 `ref.wav`로 준비합니다. 이번 비교에서는 6초 녹음을 썼습니다.
2. 그 녹음에서 말한 내용을 받아써 같은 폴더의 `ref.txt`에 저장합니다. 새로 읽힐 대본은 별도로 넣습니다.
3. 그 폴더에서 에이전트를 열고 아래 문장을 붙여 넣습니다.

설치를 맡기는 에이전트가 온라인 모델에 요청을 보내는 것과, 설치된 TTS가 로컬에서 음성을 만드는 것은 다른 과정입니다.

```text wrap
이 컴퓨터에서 한국어와 영어 나레이션을 만들고 싶어.
운영체제, 칩, 메모리와 남은 디스크 공간을 먼저 확인해 줘.
Qwen3-TTS를 공식 문서와 MLX-Audio 문서에 맞춰 별도 환경에 설치할 수 있는지 봐 줘.
내 목소리를 복제할 때는 Base 모델을 사용하고, 내 컴퓨터에 있는 ref.wav와 ref.txt를 읽게 해 줘.
녹음과 전사는 외부 서비스에 보내지 말고, 설치 용량과 실행 계획부터 알려 줘.
준비되면 짧은 한국어 한 문장을 WAV로 만들고 생성된 파일을 확인해 줘.
```

이미 MLX-Audio가 설치돼 있다면 아래는 이번 Qwen 실행에 사용한 모델 식별자와 언어 값입니다. `--ref_text`에는 예시 문구 대신 본인 녹음의 실제 내용을 넣어 주세요.

```bash
python -m mlx_audio.tts.generate \
  --model mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16 \
  --text "안녕하세요. 오늘은 새로운 음성 모델을 비교합니다." \
  --lang_code Korean \
  --ref_audio ./ref.wav \
  --ref_text "여기에 ref.wav에서 말한 내용을 적어 주세요." \
  --max_tokens 256 \
  --audio_format wav \
  --output_path ./output
```

*MLX-Audio 0.4.8에서 확인한 모델과 CLI 옵션입니다. 앞의 비교 샘플은 Python 코드로 같은 모델을 호출해 만들었습니다.*

영어를 만들 때는 대본을 영어로 바꾸고 언어 값을 `English`로 지정할 수 있습니다. 실행이 끝나면 `output` 폴더의 WAV를 열어 문장이 끝까지 나왔는지 먼저 들어보세요. 에이전트가 성공했다고 답하더라도 파일 생성과 재생은 확인하는 편이 좋습니다.

## 어떤 기준으로 고르면 좋을까요?

처음 시작한다면 Qwen3-TTS에 실제로 쓸 한국어와 영어 대본부터 넣어 보세요. 마음에 들지 않는 문장이 있을 때 다른 후보로 같은 문장을 만들어 보면 차이를 듣기 쉽습니다.

| 하려는 일 | 들어볼 부분 |
|---|---|
| 한국어 영상 나레이션 | 문장 끝, 조사, 띄어 읽는 위치 |
| 영어 나레이션 | 발음, 강세, 한국어 참고 음성의 특징이 얼마나 남는지 |
| 내 목소리 복제 | 발음의 정확성과 별개로 원래 목소리와 닮았는지 |
| 자주 고치는 짧은 영상 | 한 문장을 다시 만드는 데 걸리는 시간 |
| 감정이 있는 대사 | 원하는 감정과 속도를 조절할 수 있는지. 이번 짧은 대본으로는 평가하지 않음 |

대본대로 읽는 것과 듣기 좋은 것은 다릅니다. 생성한 열 개를 Apple의 로컬 음성 인식으로 전사했을 때, 문장부호와 공백 등을 제외하면 아홉 개가 대본과 일치했습니다. Qwen 영어 샘플에서는 마지막 `models`가 `modes`로 인식됐습니다. 음성 인식의 오인식인지 합성 발음 문제인지는 이 결과만으로 확정할 수 없습니다.

짧은 테스트 문장이 마음에 들면 다음에는 실제로 쓸 고유명사, 숫자, 한국어와 영어가 섞인 문장을 넣어 보세요. 그 대본까지 만족스럽게 읽어 주는 모델을 고르면 됩니다.

## 자주 묻는 질문

> [!faq]- 로컬 TTS는 무료인가요?
> 이 글의 샘플은 외부 TTS API 이용료 없이 만들었습니다. 모델을 저장할 공간과 컴퓨터 자원이 필요하고, 모델마다 이용 조건은 다릅니다. 공개 다운로드 가능 여부와 상업 이용 허용 범위는 따로 확인해야 합니다.

> [!faq]- 한국어와 영어를 같은 목소리로 만들 수 있나요?
> 이번 다섯 설정에서는 같은 한국어 참고 녹음으로 두 언어의 음성 파일을 만들었습니다. 두 언어에서 목소리가 얼마나 비슷하게 유지되는지는 위 샘플을 듣고 비교할 수 있습니다.

> [!faq]- 어떤 컴퓨터에서나 쓸 수 있나요? / Can I run local TTS on any PC?
> 이번에는 Apple M5 Pro, 메모리 48GB Mac에서 실행했습니다. 다른 컴퓨터의 지원 여부나 최소 메모리를 확인한 결과는 아닙니다. 사용하려는 모델과 실행 도구의 문서에서 운영체제와 하드웨어 조건을 확인해 주세요.

## 참고 자료

- [Qwen3-TTS 공식 모델과 실행 안내](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base)
- [VoxCPM2 공식 프로젝트](https://github.com/OpenBMB/VoxCPM)
- [Higgs TTS 3 공식 모델](https://huggingface.co/bosonai/higgs-tts-3-4b)
- [MOSS-TTS Local Transformer 공식 모델](https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Local-Transformer-v1.5)
- [Fish Audio Drama 3 공식 모델](https://huggingface.co/fishaudio/drama-3)
- [MLX-Audio](https://github.com/Blaizzy/mlx-audio), [이번 대안 모델에 사용한 소스 버전](https://github.com/Blaizzy/mlx-audio/tree/1865f49cc9a40de9b5e4fcf55952b9812d751f1d)
- [Drama 3용 audio.cpp 실행 안내](https://github.com/0xShug0/audio.cpp/blob/main/docs/models/fish_drama3.md), [사용한 GGUF 변환본](https://huggingface.co/Jmica/Drama-3-GGUF/blob/main/drama-3-backbone-8bit-experts-Q4_K_S.gguf)

작성 기준: 2026-10-20. 한 목소리와 언어별 한 문장으로 생성한 결과입니다.

이 글은 AI의 도움을 받아 작성했습니다.
