# 받쓰몬 👾

> 급수표를 찍으면 선생님처럼 읽어 주는 **혼자 하는 받아쓰기** 앱

초등학교 저학년 아이가 학교에서 받아온 받아쓰기 급수표를 사진으로 찍으면, 앱이 문장을 읽어 내고(OCR) 선생님처럼 **문제마다 3번씩** 읽어 줍니다. 부모가 옆에서 매번 불러 주지 않아도 아이 혼자 받아쓰기 연습을 할 수 있습니다.

- 서버 없음 · 로그인 없음 · 사진은 어디에도 업로드하지 않음
- iPhone / iPad Safari에서 홈 화면에 추가하면 앱처럼 동작 (PWA)
- 모든 학습 기록은 기기 안(IndexedDB)에만 저장

---

## 사용 흐름

```
📷 급수표 찍기 → OCR로 문장 인식 → 회차 선택 → 인식 결과 확인·수정
→ 🎧 랜덤 순서로 받아쓰기 (문제마다 3번 읽기) → 🎉 받아쓰기 끝!
→ ✏️ 부모가 채점 → 🔥 틀린 문제만 다시 시험 → … → 🎉 오답 정복 완료!
```

## 주요 기능

| 영역 | 기능 |
| --- | --- |
| 급수표 촬영 | 카메라 바로 촬영(`capture="environment"`), 사진 앱에서 선택, 미리보기, 좌/우 회전, 다시 찍기 |
| OCR | Tesseract.js `kor`, 브라우저 안에서 처리, 진행률 표시, Canvas 전처리(리사이즈·흑백·대비 향상) |
| 자동 정리 | 회차 자동 분리(`1회`, `1회차`, `제1회`, `[2회]`…), 번호 제거(`1.` `1)` `(1)` `①` `1번` `1 -`), 페이지 번호·빈 줄·노이즈 제거, 두 줄로 나뉜 문장 합치기 |
| 결과 수정 | 급수표 이름·회차 이름 변경, 문장 수정/추가/삭제/순서 변경, 회차 추가/삭제, 인식 원문 보기 |
| 직접 입력 | OCR이 안 될 때 여러 문장을 붙여넣기 → 줄마다 한 문제 |
| 시험 | 랜덤 출제(중복 없음), 정답 문장 숨김, “첫 번째 문제입니다.” → 문장 3번 → 안내, 다시 듣기, 연타 방지 |
| 채점 | 기본 “맞았어요 ✅”, 틀린 문제만 “틀렸어요 ❌” 선택 |
| 재시험 | 틀린 문제만 랜덤 재출제 → 모두 맞을 때까지 반복 → “오답 정복 완료!” |
| 오답노트 | 문장·급수표·회차·틀린 횟수·맞힌 횟수·최근 틀린 날짜·상태 저장, 오늘/최근 7일/전체 필터, 오답 시험 |
| 급수표 관리 | 저장·이름 변경·내용 수정·삭제·회차별 시험 시작 |
| 부모 설정 | 아이 이름(“서윤이의 받아쓰기”), 읽기 속도(0.75/0.88/1.0), 반복 1~5회(기본 3회), 반복 사이 쉬는 시간, 랜덤 출제, 문제 번호 읽기, 마지막 안내, 문장 숨기기, 자동 채점 화면 이동, 학습 기록 초기화 |
| PWA | manifest, 서비스 워커(오프라인 캐시), 아이콘, standalone 실행 |

## 프로젝트 구조

```
batssumon/
├─ .github/workflows/
│  ├─ deploy.yml            # main push → lint·test·build → GitHub Pages 배포
│  └─ e2e.yml               # PR 시 Playwright(WebKit) E2E
├─ e2e/dictation.spec.ts    # 모바일 WebKit E2E (speechSynthesis mock)
├─ public/
│  ├─ manifest.webmanifest
│  ├─ sw.js                 # 서비스 워커
│  └─ icons/                # 앱 아이콘 (192, 512, maskable, apple-touch)
├─ scripts/icon-source.svg  # 아이콘 원본
├─ src/
│  ├─ components/           # Monster(마스코트), TopBar, Toggle/Segmented/ProgressBar
│  ├─ hooks/
│  │  ├─ useSpeech.ts       # TTS React 훅 (unmount 시 cancel)
│  │  └─ useExamStarter.ts  # 시험 시작 공통 로직
│  ├─ pages/                # 홈, 촬영, 직접 입력, 결과 수정, 시험, 끝, 채점, 결과, 급수표 목록, 오답노트, 설정
│  ├─ services/
│  │  ├─ ocrService.ts      # OCR 엔진 인터페이스 + Tesseract.js 구현
│  │  ├─ imageProcessing.ts # Canvas 전처리
│  │  ├─ speechService.ts   # 순차 재생 TTS 엔진 + 읽기 스크립트
│  │  └─ storageService.ts  # IndexedDB 저장소 (메모리 대체 저장소 포함)
│  ├─ store/AppContext.tsx  # 화면 전환·설정·시험 세션 상태
│  ├─ styles/global.css
│  ├─ types/index.ts
│  └─ utils/
│     ├─ dictationParser.ts # OCR 텍스트 → 회차/문제 목록
│     ├─ exam.ts            # 셔플, 채점, 재시험, 오답노트 반영, 기간 필터
│     ├─ korean.ts          # 이름 조사(서윤→서윤이), 서수(첫 번째, 스무 번째…)
│     └─ …                  # date, id, settings, sheet
├─ index.html
├─ vite.config.ts           # GITHUB_REPOSITORY 기반 base path 자동 계산
└─ playwright.config.ts
```

## 실행 방법

Node.js 20.19 이상(권장 22)이 필요합니다.

```bash
npm install
npm run dev          # 개발 서버 (같은 Wi-Fi의 iPhone에서 http://<PC IP>:5173 으로 접속 가능)
npm run build        # 타입 검사 + 프로덕션 빌드 (dist/)
npm run preview      # 빌드 결과 미리보기
npm test             # 단위 테스트 (Vitest)
npm run lint         # ESLint
```

E2E 테스트 (모바일 WebKit):

```bash
npx playwright install webkit   # 처음 한 번
npm run test:e2e
```

> ⚠️ iPhone에서 카메라·음성 기능을 개발 서버로 시험하려면 HTTPS가 필요한 경우가 있습니다. 가장 쉬운 방법은 아래처럼 GitHub Pages에 배포해서 확인하는 것입니다.

## GitHub Pages 배포 방법

1. GitHub에 새 저장소를 만듭니다. (예: `stella-batssumon`)
2. 이 프로젝트를 올립니다.
   ```bash
   git init
   git add .
   git commit -m "받쓰몬 첫 버전"
   git branch -M main
   git remote add origin https://github.com/<사용자명>/stella-batssumon.git
   git push -u origin main
   ```
3. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 선택합니다.
4. `main` 브랜치에 push할 때마다 `.github/workflows/deploy.yml`이 자동으로 실행됩니다.
   (의존성 설치 → ESLint → 단위 테스트 → 빌드 → 배포)
5. 몇 분 뒤 `https://<사용자명>.github.io/stella-batssumon/` 에서 열립니다.

**base path 자동 계산:** GitHub Actions의 `GITHUB_REPOSITORY` 값(예: `stella-lucio/stella-batssumon`)에서 저장소 이름을 꺼내 `/stella-batssumon/`을 base로 사용합니다. 저장소 이름을 바꿔도 설정을 고칠 필요가 없습니다. 저장소 이름이 `<사용자명>.github.io`이면 `/`로 배포됩니다. 다른 경로가 필요하면 `VITE_BASE=/경로/ npm run build`로 직접 지정할 수 있습니다.

## iPhone / iPad 홈 화면에 설치하기

1. **Safari**로 배포 주소(`https://<사용자명>.github.io/<저장소>/`)를 엽니다.
2. 아래(iPad는 위쪽)의 **공유 버튼(□↑)** 을 누릅니다.
3. **“홈 화면에 추가”** 를 누르고, 이름이 “받쓰몬”인지 확인한 뒤 **추가** 를 누릅니다.
4. 홈 화면의 받쓰몬 아이콘을 누르면 주소창 없이 앱처럼 열립니다.

처음 사용할 때 확인할 것:

- **소리가 안 나면:** 아이폰 옆면의 무음 스위치를 끄고, 음량을 올려 주세요. (iOS는 무음 모드에서 음성 읽기도 조용해질 수 있어요)
- **한국어 음성 품질:** 설정 → 손쉬운 사용 → 읽기 및 말하기 → 음성 → 한국어에서 “유나(향상됨)” 등을 내려받으면 더 자연스럽게 읽습니다. 앱은 한국어 음성을 자동으로 찾아 사용합니다.
- **첫 OCR:** 한국어 글자 인식 데이터를 처음 한 번 내려받기 때문에 인터넷이 필요하고 시간이 조금 걸립니다. 이후에는 캐시되어 빨라집니다.
- **카메라 권한:** “카메라로 찍기”를 처음 누르면 Safari가 카메라 사용을 묻습니다.

## 개인정보

- 사진은 브라우저 안에서만 처리하고, 인식이 끝나면 메모리에서 지웁니다. 사진 자체는 저장하지 않습니다.
- 급수표·문장·오답 기록·학습 기록·설정은 기기의 IndexedDB에만 저장됩니다.
- 외부로 나가는 요청은 OCR 엔진/한국어 인식 데이터와 글꼴(Pretendard)을 CDN(jsDelivr)에서 **내려받는 것뿐**이며, 사진이나 문장은 전송하지 않습니다.

## 현재 알려진 제한사항

- **OCR 정확도:** Tesseract의 한국어 인식은 손글씨·흐린 인쇄·기울어진 사진에 약합니다. 그래서 인식 후 반드시 수정 화면을 거치도록 했습니다. 인식이 어려우면 “직접 입력”을 사용해 주세요.
- **표 형태 급수표:** 칸이 여러 열로 나뉜 급수표는 읽는 순서가 섞일 수 있습니다. 한 열씩 찍거나 수정 화면에서 순서를 바꿔 주세요.
- **음성:** 음성 품질과 속도는 기기에 설치된 한국어 음성에 따라 다릅니다. 한국어 음성이 없는 기기에서는 기본 음성으로 읽습니다.
- **iOS 오디오 정책:** iOS는 사용자가 버튼을 누른 뒤에만 소리를 낼 수 있어서, 시험 시작 시 “🎧 시작하기” 버튼을 한 번 누르도록 했습니다.
- **데이터 백업:** 서버가 없으므로 Safari 방문 기록·웹사이트 데이터를 지우면 학습 기록도 사라집니다. 사생활 보호 모드에서는 앱을 닫으면 기록이 남지 않습니다.
- **첫 OCR은 온라인 필요:** OCR 데이터를 한 번 받은 뒤에는 오프라인에서도 동작하도록 캐시하지만, 최초 1회는 인터넷이 필요합니다.

## 향후 개선하면 좋은 기능

코드는 아래 기능을 붙이기 쉽게 나눠 두었습니다.

- **AI OCR API 교체:** `OcrEngine` 인터페이스를 구현해 `setOcrEngine()`으로 교체 (`src/services/ocrService.ts`)
- **AI 문장 교정:** 파서 결과를 수정 화면에 넘기기 전에 교정 단계 추가 (`dictationParser.ts` 뒤)
- **음성 녹음:** 부모 목소리로 녹음해 TTS 대신 재생 (`SpeechStep`에 오디오 단계 추가)
- **부모 계정 / 기기 간 동기화:** `StorageBackend` 구현 추가 (`storageService.ts`)
- **아이 여러 명 등록:** `Settings`·기록에 아이 ID 추가
- **학습 통계 · 점수/포인트 · 칭찬 스티커:** `StudyRecord` 기반 화면 추가
- **학교/학년별 급수표 공유:** 급수표 JSON 내보내기/가져오기부터 시작
- **받아쓰기 문제 PDF 출력:** 급수표를 인쇄용 시험지로 출력
