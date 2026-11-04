[English](./README.md) | [Türkçe](./README.tr.md) | [한국어](./README.ko.md) | [日本語](./README.ja.md) | [中文](./README.zh.md)

> 이 문서는 영어 README를 번역한 것입니다. 일부 표현이 부자연스러울 수 있습니다.

<h1 align="center">prisme</h1>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/></a>
</p>

<p align="center">
  프리즘은 백색광을 선명한 색으로 나눕니다.<br/>
  <strong>prisme은 복잡한 프로젝트를 초보자부터 시니어 개발자까지 누구나 이해할 수 있는 부분으로 나눕니다.</strong>
</p>

---

## 빠른 시작

prisme은 아직 npm에 없습니다. 소스에서 설치한 다음, AI 코딩 도구에 스킬을 등록하세요:

```bash
git clone https://github.com/a-diarrassouba/oh-my-mermaid-le-retour.git prisme
cd prisme && npm install && npm link
prisme setup
```

이후 `prisme update`가 이 클론을 가져와 다시 빌드합니다.

이해하고 싶은 프로젝트에서 문서 언어를 선택하세요 (선택 사항, 기본값은 영어):

```bash
prisme config language fr
```

그런 다음 해당 프로젝트에서 AI 코딩 도구를 열고 `/prisme-scan` 스킬을 실행하세요:

```
/prisme-scan
```

결과를 보고, 뷰어가 제안하는 환영 가이드를 따라가세요:

```bash
prisme view
```

## 작동 방식

AI가 코드베이스를 읽고 **perspective**를 작성합니다. perspective는 프로젝트를 바라보는 서로 다른 관점입니다: 무엇을 하고 누구를 위한 것인지, 어떻게 만들어졌는지, 데이터가 어떻게 흐르는지, 어떻게 보호되는지, 어떻게 실행·테스트·배포하는지, 그리고 현재 상태. 각 perspective는 선택한 언어로 Mermaid 다이어그램과 문서 필드를 담고 있습니다.

모든 element는 **재귀적으로 분석**됩니다. 복잡한 element는 자체 다이어그램을 가진 중첩 element가 되고, 단순한 element는 leaf로 남습니다. 파일 시스템이 트리를 반영합니다:

```
.prisme/
├── functional-overview/            ← perspective
├── overall-architecture/
│   ├── description.md
│   ├── diagram.mmd
│   ├── context.md
│   ├── main-process/               ← 중첩 element
│   │   ├── description.md
│   │   ├── diagram.mmd
│   │   └── auth-service/           ← 더 깊은 중첩
│   │       └── ...
│   └── renderer/
│       └── ...
├── data-flow/
├── operations/
├── project-status/
└── .guides/                        ← 가이드 (단계별 안내)
```

뷰어는 파일 시스템에서 중첩을 자동으로 감지합니다 — 자식이 있는 element는 펼칠 수 있는 그룹으로, 나머지는 노드로 렌더링됩니다.

각 element는 최대 7개 필드(`description`, `diagram`, `context`, `constraint`, `concern`, `todo`, `note`)와 표시 제목을 가집니다.

### 가이드

**가이드**는 다이어그램을 단계별로 따라가는 안내입니다. 뷰어는 각 element를 열고, 나머지는 흐리게 하며, 따라가는 연결선을 강조합니다. AI 도구에서 `/prisme-guide`로 요청하세요 (예: `/prisme-guide 사용자가 가입하면 무슨 일이 일어나나요?`). `/prisme-scan`은 환영 가이드 `start-here`도 작성합니다. 세 부분(프로젝트가 하는 일, 구성 방식, 실행·테스트·배포 방법)으로 이루어지며, 뷰어가 처음 방문할 때 제안합니다. 가이드는 `.prisme/.guides/`에 저장되며, 새 스캔으로 가이드가 깨지면 `prisme validate`가 알려줍니다.

### 질문

뷰어의 질문 창에 어떤 질문이든 입력하세요 (예: "`prisme write`를 실행하면 무슨 일이 일어나나요?", "세션은 어디서 확인되나요?"). Claude Code가 다이어그램 위에서 답합니다: 화살표를 따라 경로를 그리고, 살펴볼 블록을 강조하거나, 파일을 해당 줄에서 열며, 각 단계마다 설명을 붙입니다. 그동안 질문의 단어와 일치하는 element가 강조됩니다. 답변은 왼쪽 패널의 "내 질문"에 보관됩니다.

이 기능은 `prisme view`를 실행하는 컴퓨터에 Claude Code가 설치되고 로그인되어 있어야 합니다 (`claude` 실행 후 `/login`). 뷰어만 여는 사람은 아무것도 필요하지 않습니다. Claude는 프로젝트를 읽기만 하며 (`.env` 파일이나 키는 읽지 않음) 절대 수정하지 않습니다. `prisme view --no-ai`로 질문 기능을 끌 수 있습니다.

홈 화면의 보안 타일을 클릭하면 점수를 계산합니다: 알려진 위험(비밀 정보, 위험한 코드, OpenSSF Scorecard 방식의 CI·의존성 관리)을 자동으로 점검하며, 각 항목에 OWASP Top 10 분류가 붙고, 아무것도 설치할 필요가 없습니다. 이어서 `/prisme-security`로 Claude가 각 항목을 검토합니다.

## CLI

```bash
prisme setup                       # AI 도구에 스킬 등록
prisme view                        # 뷰어 열기: 수준을 고른 뒤 세 가지 공간 (지도는 /map)
prisme view --no-ai                # Claude Code 질문 없이 열기 (API: docs/api.md)
prisme config language fr          # 문서와 인터페이스 언어 설정
prisme guide list                  # 가이드 목록 보기
prisme changes                     # 마지막 스캔 이후 변경 사항
prisme security                    # 자동 점검 보안 점수 A–E (gitleaks, osv-scanner, semgrep이 설치되어 있으면 사용)
prisme security threats show       # /prisme-security가 작성한 위협 모델(element별 STRIDE)과 설계 질문
prisme evolve show                 # /prisme-evolve가 작성한 프로젝트 발전 아이디어
prisme update                      # 최신 버전으로 업데이트
```

전체 명령어 목록은 `prisme help`를 실행하세요.

## 스킬

스킬은 **AI 코딩 도구 안에서** 실행하는 명령입니다 (터미널이 아님). `/`로 시작합니다.

| 스킬 | 기능 |
| --- | --- |
| `/prisme-scan` | 코드베이스 분석 → 문서와 환영 가이드 작성 |
| `/prisme-guide` | 질문에 답하는 단계별 가이드 작성 → 뷰어에서 재생 |
| `/prisme-security` | `prisme security` 실행, 등급을 쉬운 말로 설명, 각 항목 확인 후 동의한 것만 수정; 지도의 위협 모델(element별 STRIDE)과 보안 설계 질문 작성 |
| `/prisme-evolve` | 코드를 단순화·가속·확장하는 아이디어와 유사 제품 3~5개의 기능·디자인 비교 |
| `/prisme-view` | 뷰어 열기 |

## 지원 AI 도구

| 플랫폼 | 설정 |
| --- | --- |
| Claude Code | `prisme setup claude` |
| Codex | `prisme setup codex` |
| Cursor | `prisme setup cursor` |
| OpenClaw | `prisme setup openclaw` |
| Antigravity | `prisme setup antigravity` |

`prisme setup`을 실행하면 설치된 모든 도구를 자동으로 감지하고 설정합니다.

## 개발 및 기여

```bash
git clone https://github.com/a-diarrassouba/oh-my-mermaid-le-retour.git
cd oh-my-mermaid-le-retour
npm install && npm run build
npm test
```

이슈와 PR을 환영합니다. [Conventional Commits](https://www.conventionalcommits.org/)를 사용해 주세요.

## 크레딧

prisme은 MIT 라이선스로 공개된 [oh-my-mermaid](https://github.com/oh-my-mermaid/oh-my-mermaid)의 포크에서 시작되었습니다.

## 라이선스

[MIT](./LICENSE)
