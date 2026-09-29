---
title: "한글(HWP) 문서가 검색되지 않던 이유, AutoRAG Agent 2.6.0의 파서 교체"
description: "AutoRAG Agent 2.5.3에서 실제 한글 문서 9개를 색인했더니 5개가 조용히 빠졌습니다. 2026-09-29에 나온 2.6.0이 한글, PDF, 워드, 엑셀 파서를 kordoc으로 바꾼 이유와 바뀐 점, 내 문서가 빠지는지 직접 확인하는 방법을 정리했습니다."
pubDatetime: 2026-09-29T19:00:00+09:00
author: "안승원 (Aiden)"
tags: ["autorag agent", "오토래그", "hwp", "한글 문서 검색", "kordoc", "릴리스 노트", "오픈소스"]
featured: false
---
> **요약**
>
> 1. AutoRAG Agent 2.5.3에서 제 컴퓨터의 실제 한글 문서(HWP 8개, HWPX 1개)를 색인했더니 9개 중 5개가 검색 대상에서 빠졌습니다. 파일 크기와는 관계가 없었고, 빠졌다는 사실은 색인 결과의 진단 항목에만 남았습니다.
> 2. 2026-09-29에 나온 2.6.0은 한글, PDF, 워드, 엑셀을 읽는 파서를 [kordoc](https://github.com/chrisryugj/kordoc)으로 바꿨습니다. 같은 저장소의 PR 설명에는 예전에 실패하던 한글 문서가 읽힌다는 결과가 적혀 있습니다.
> 3. 이번 파서 교체는 기존 동작을 바꾸는 변경입니다. PDF를 읽을 때 Java가 필요 없어지고, 병합되거나 중첩된 표는 HTML 표로 나옵니다. 업그레이드 뒤 첫 `refresh`에서는 문서를 다시 읽습니다.
> 4. 이 글을 쓴 시점에 저는 2.6.0을 직접 돌려 보지 못했습니다. 2.5.3 수치는 제가 잰 값이고, 2.6.0 수치는 PR 작성자의 자체 보고입니다.

## 목차

## 지원 형식인데 검색이 안 되는 문서

AutoRAG Agent는 검색 폴더 안의 한글(HWP, HWPX), PDF, 워드, 엑셀 파일을 마크다운으로 바꿔 색인합니다. [지난 글](/posts/autorag-agent-intro/)에서 소개한 대로 따로 설정하지 않아도 알아서 읽습니다.

그런데 "알아서 읽는다"가 "전부 읽는다"는 뜻은 아닙니다. 파트너사 브레인크루의 [AutoRAG Agent 실험 글](https://tech.brain-crew.com/engineering/autorag-agent-local-librarian)도 "정부 양식 HWP 일부는 파싱에 실패했다"고 적었고, 업무 문서 75개 중 파서 실패가 6개였다고 밝혔습니다.

같은 일이 제 문서에서도 일어나는지 확인해 봤습니다. 제 컴퓨터에 있던 실제 업무 문서에서 개인 서류를 뺀 한글 파일 9개(HWP 8개, HWPX 1개)를 복사해 새 폴더에 두고, 2.5.3으로 색인했습니다. 공고문, 계획서, 기획서, 요청서와 양식이 섞여 있습니다.

## 2.5.3에서 실제로 잰 결과

9개 중 4개만 색인됐고 5개는 `parser-failed`로 빠졌습니다.

| 결과 | 파일 수 | 파일 크기 |
|---|---|---|
| 색인됨 | 4 | 62KB, 105KB(HWPX), 129KB, 5.0MB |
| 파서 실패, 검색 대상에서 제외 | 5 | 166KB, 361KB, 658KB, 1.6MB, 2.8MB |

*2026-09-29 측정, AutoRAG Agent 2.5.3. 문서 제목과 내용은 밝히지 않습니다.*

세 가지가 눈에 띄었습니다.

1. **크기와 상관이 없습니다.** 5.0MB 파일은 읽혔고 166KB 파일은 실패했습니다. 파일이 크거나 작아서가 아니라 문서 안의 구조 때문으로 보이지만, 제 파일에서 정확한 원인까지는 확인하지 못했습니다.
2. **실패가 눈에 잘 안 띕니다.** 색인은 `ok: true`로 끝나고, 실패한 파일은 진단 항목에 이런 문장으로만 남습니다.

   ```text wrap
   The registered parser failed on this file; it was skipped during indexing.
   ```

   `refresh` 결과를 `--json`으로 보지 않으면 실패를 못 보고 지나갈 수 있습니다. 그 문서는 이후 검색에서 아예 나오지 않습니다. 검색 결과에 없을 뿐이라 "그런 내용이 없나 보다"로 오해하기 쉽습니다.
3. **읽힌 문서는 잘 읽힙니다.** 색인된 4개에서는 828자에서 7,591자의 본문이 나왔고, 표가 있는 문서 3개에서 표도 변환됐습니다.

## 2.6.0에서 바뀐 것

2.6.0은 2026-09-29에 나왔습니다. [릴리스 노트](https://github.com/Marker-Inc-Korea/AutoRAG/releases/tag/v2.6.0)에는 변경이 열두 개 있고, 문서 읽기와 관련된 것은 `feat(parser)!: parse documents with kordoc and add a global language setting`([PR #1717](https://github.com/Marker-Inc-Korea/AutoRAG/pull/1717)) 하나입니다. 제목의 `!`는 기존 동작이 바뀌는 변경이라는 표시입니다.

PR 설명에 적힌 문제는 제가 본 것과 같습니다. 표가 중첩된 실제 `.hwp` 다섯 개가 모두 `ParseError`로 색인에서 빠졌다고 합니다. HWPX는 안쪽 XML이 본문에 섞여 들어갔고, XLSX는 시트와 행 구분 없이 셀 값만 나열됐으며, PDF는 Java 11 이상이 필요했고 기본 Java가 오래된 컴퓨터에서는 실패했다고 합니다.

바뀐 내용은 이렇습니다.

- **읽는 파일 형식**: `.hwp`, `.hwpx`, `.hml`, `.hwpml`, `.pdf`, `.docx`, `.xlsx`, `.xls`를 오픈소스(MIT) 라이브러리 kordoc으로 읽습니다. 별도 프로세스 없이 한 프로세스 안에서 돌고 Java가 필요 없습니다. `.pptx`, `.eml`, 일반 텍스트는 예전 파서를 그대로 씁니다.
- **표**: 병합되거나 중첩된 표는 HTML 표로, 단순한 표는 마크다운 표로 나옵니다. 예전처럼 평평하게 펴지 않습니다.
- **언어 설정**: `languages` 설정이 새로 생겼고 기본값은 `["ko","en"]`입니다. 우선순위는 `--languages` 옵션, `AUTORAG_LANGUAGES` 환경 변수, 설정 파일, 기본값 순이고 `autorag init`이 값을 저장합니다. 지원하는 언어 태그는 `ko en ja zh-hans zh-hant fr de es ru it pt vi th ar hi` 열다섯 개입니다.
- **이미지 글자 인식(OCR)**: 여전히 켜야 쓰는 기능이고, 위 언어 설정에 맞춰 tesseract 언어 데이터가 정해집니다. `.webp`도 읽는 이미지에 들어갔습니다.
- **의존성**: `@opendataloader/pdf`(23MB와 Java), `@rhwp/core`(10MB), 런타임 `xlsx`(7.2MB)가 빠지고 `kordoc`과 `pdfjs-dist`가 들어왔습니다.

### PR 작성자가 보고한 결과

아래는 PR 작성자가 macOS에서 실제 문서로 돌린 결과입니다. 제가 재현한 값이 아닙니다.

| 문서 | 예전 결과 | 2.6.0 결과 |
|---|---|---|
| 26쪽 공고문(HWP) | `ParseError`, 본문 전체 누락 | 51,469자, HTML 표 39개 |
| 사업 계획서(HWP, 5.4MB) | `ParseError` | 20,642자, HTML 표 26개 |
| 양식(HWP) | `ParseError` | 2,716자 |
| PDF | Java 필요 | Java 없이 17,260자 |
| 중첩 표가 있는 HWPX | 안쪽 XML이 본문에 섞임 | 섞임 없이 표 안에 표가 들어감 |

작성자가 적어 둔 알려진 문제도 있습니다. 언어를 둘 이상 고르면 tesseract.js가 `Failed loading language ''`를 화면에 찍는데 인식 결과는 정상입니다. kordoc은 본문의 밑줄을 `\_`로 바꿔 씁니다. 둘 다 이번 변경에서 생긴 문제가 아니라고 적혀 있습니다.

## 업그레이드하기 전에 알아둘 것

- **다시 읽습니다.** 색인에 기록된 파서 이름이 바뀌므로 업그레이드 뒤 첫 `refresh`에서 변환 사본을 다시 만듭니다. 따로 옮겨야 할 것은 없다고 PR에 적혀 있습니다. 문서가 많으면 그만큼 시간이 걸립니다.
- **진단 코드가 사라집니다.** Java PDF 경로와 함께 `pdf-java-version`, `pdf-hybrid-unavailable`이 없어졌습니다. 이 코드로 알림이나 스크립트를 만들었다면 고쳐야 합니다.
- **변환 결과가 달라집니다.** 표가 HTML로 나오는 문서는 같은 질문에도 검색 결과 문구가 예전과 다를 수 있습니다. 날짜나 금액처럼 정확해야 하는 값은 이전과 마찬가지로 출처를 열어 확인하세요.
- **지난 글의 준비물이 바뀝니다.** 지난 글에서 PDF를 읽으려면 Java 11 이상이 필요하다고 적었는데, 2.6.0부터는 필요하지 않다고 PR에 적혀 있습니다. 직접 확인하면 지난 글도 고치겠습니다.

## 내 문서가 빠지는지 확인하는 방법

이 확인은 버전과 상관없이 해 볼 만합니다. 지금 쓰는 색인을 건드리지 않도록 설정 파일과 작업 폴더를 따로 지정하고, 검사할 문서는 복사본을 둔 폴더에서 돌립니다.

```bash
mkdir -p check/corpus            # 검사할 문서를 여기에 복사
autorag init --config check/config.json --workspace check/ws \
  --memory-path check/ws/memory.json --search-paths check/corpus --force
autorag refresh --config check/config.json --method parsed --full --json \
  | jq '.counts, [.diagnostics[] | select(.code=="parser-failed") | .source]'
```

`counts`의 `scanned`(훑은 수)와 `skipped`(빠진 수)를 비교하고, 뒤의 목록에서 어떤 파일이 빠졌는지 봅니다. 이 명령은 모델도 API 키도 쓰지 않습니다. 빠진 파일이 있으면 [이슈](https://github.com/Marker-Inc-Korea/AutoRAG/issues)에 남겨 주세요. 문서 내용은 올리지 말고, 파일 크기와 어떤 종류의 문서인지만 적어도 원인을 찾는 데 도움이 됩니다.

## 마치며

문서 검색 도구를 고를 때 "이 형식을 지원하나요"만 묻기 쉽습니다. 이번에 확인한 것은 지원한다고 적힌 형식에서도 문서마다 읽히는지가 갈리고, 못 읽은 문서는 조용히 빠진다는 점입니다. 2.6.0은 이 부분을 라이브러리 교체로 손봤습니다. 다만 제가 아직 직접 돌려 보지 못했으니, 같은 문서로 2.6.0을 돌려 보고 이 글을 고쳐 쓰겠습니다.

- **저장소**: [github.com/Marker-Inc-Korea/AutoRAG](https://github.com/Marker-Inc-Korea/AutoRAG). 도움이 됐다면 star를 눌러 주세요
- **처음 기여**: [`good first issue`와 `AutoRAG-2.0` 라벨이 붙은 이슈](https://github.com/Marker-Inc-Korea/AutoRAG/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3AAutoRAG-2.0)부터 보시면 됩니다

## 자주 묻는 질문

> [!faq]- 제 문서가 검색되지 않으면 무조건 파서 문제인가요?
> 아닙니다. 다른 파일과 내용이 같아 중복으로 빠졌거나, 이미지로만 된 PDF라 글자가 없거나, 검색어가 문서와 잘 맞지 않는 경우도 있습니다. 위의 확인 명령에서 `parser-failed`로 나온 파일이 파서 문제입니다.

> [!faq]- 예전 색인은 지우고 다시 만들어야 하나요?
> PR 설명에는 다시 만들 필요가 없다고 적혀 있습니다. 색인에 기록된 파서 이름이 바뀐 것을 알아보고 다음 `refresh`에서 알아서 다시 읽는다고 합니다. 이 동작은 제가 직접 확인하지 못했습니다.

> [!faq]- 스캔한 이미지 문서도 읽히나요?
> 이미지로만 된 PDF와 이미지 파일은 글자 인식(OCR)을 켜야 읽힙니다. 2.6.0에서는 `languages` 설정에 맞는 언어로 인식하며 기본은 한국어와 영어입니다.

> [!faq]- 파워포인트와 메일은 어떻게 되나요?
> `.pptx`, `.eml`, 일반 텍스트는 kordoc이 다루지 않아서 예전 파서를 그대로 씁니다. 이번 변경에서 달라지지 않습니다.

## 참고 자료

**AutoRAG**

- [AutoRAG v2.6.0 릴리스 노트](https://github.com/Marker-Inc-Korea/AutoRAG/releases/tag/v2.6.0) - 2026-09-29
- [PR #1717, kordoc 파서와 언어 설정](https://github.com/Marker-Inc-Korea/AutoRAG/pull/1717) - 문제, 변경, 검증 결과
- [kordoc](https://github.com/chrisryugj/kordoc) - 한글, PDF, 워드, 엑셀을 읽는 오픈소스 라이브러리(MIT)

**파트너 글**

- [브레인크루, AutoRAG Agent: 문서와 메신저 검색부터 출처 기반 답변까지](https://tech.brain-crew.com/engineering/autorag-agent-local-librarian) - 정부 양식 HWP 파싱 실패를 포함한 실험 결과

**갱신 이력**

- 2026-09-29 최초 발행. 2.6.0은 직접 돌려 보기 전이라 PR 작성자의 보고를 옮겼습니다.

---

이 글은 AI의 도움을 받아 작성했습니다. 2.5.3의 수치는 직접 실행한 결과에서 옮겼고, 2.6.0의 수치는 릴리스 노트와 PR 설명을 옮겼습니다.
