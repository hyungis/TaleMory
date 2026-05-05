# About 페이지 미리보기용 StoryBookViewer `preview` 모드

작성일: 2026-05-05
작성자: 강지석
대상 브랜치: `dev` 진입 전 feature 브랜치

## 배경

`AboutPage` ("서비스 소개") 의 "완성된 동화책을 미리 볼까요?" 섹션은 현재 일반 웹 뷰어인 `StoryBookViewer` 를 그대로 임베드한다. 일반 뷰어는 좌측 사이드 툴바 (전체 자동재생 / 일시정지 / 한글 해석 토글 / 글자크기 슬라이더 / 책갈피) + 우상단 전체화면 버튼까지 모든 기능을 노출한다.

About 페이지는 "동화책이 어떻게 생겼는지 살짝 보여주는" 자리이지 "동화책을 본격적으로 읽는" 자리가 아니다. 풀 기능 뷰어를 그대로 끼워넣으니 첫 인상이 과하고, 또 sample story 의 책갈피가 localStorage 에 들어가 실제 뷰어 동작과 충돌할 여지도 있다.

미리보기를 다이어트하되, 일반 뷰어 (`/viewer/:storyId`, `/shared/:token`) 는 1픽셀도 안 건드리는 게 본 작업의 목표.

## 결정한 접근 — `mode` prop 추가

세 가지 후보 중 채택:

| 안 | 요지 | 채택 여부 |
|---|---|---|
| A | `StoryBookViewer` 에 `mode: 'full' \| 'preview'` prop 추가, About 만 `preview` | **채택** |
| B | About 전용 별도 컴포넌트 `SampleBookViewer` 신설 | 기각 — 페이지 플립 / `useStoryTts` / 표지 전환 등 핵심 로직 거의 다 재구현 필요 |
| C | 공통 코어 `BookViewerCore` 추출 + 두 wrapper | 기각 — 변경 범위 대비 오버킬 |

A 채택 근거: preview 분기는 5~6 곳의 단순 conditional 로 끝나며, viewer 의 핵심 로직 (페이지 모델, TTS 훅, 페이지 플립 애니메이션) 은 양쪽이 100% 공유한다. B 는 중복 비용이 크고, C 는 지금 변경 범위 대비 리팩토링이 과하다.

## 변경 범위

### 수정 파일 (2개)

1. `app/frontend/src/features/viewer/story-book/ui/StoryBookViewer.tsx` — `mode` prop 추가 + preview 분기
2. `app/frontend/src/pages/about/AboutPage.tsx` — `<StoryBookViewer ... mode="preview" />` 호출 한 줄

### 미수정 파일 (검증 대상)

- `app/frontend/src/pages/viewer/ViewerPage.tsx`
- `app/frontend/src/pages/viewer/SharedViewerPage.tsx`
- `app/frontend/src/features/viewer/story-book/ui/ViewerToolbar.tsx`
- `app/frontend/src/features/viewer/story-book/ui/BookSpread.tsx`

이들은 mode prop 을 안 넘기므로 default `'full'` 로 떨어져 기존 동작 그대로 유지돼야 한다.

## 상세 동작

### Props 추가

```ts
interface StoryBookViewerProps {
  story: StoryView
  onExit: () => void
  /** 'full' (기본): 일반 뷰어 — 모든 도구 노출.
   *  'preview': About 페이지 미리보기 — 사이드툴바/전체화면/책갈피/글자크기/한글토글 제거,
   *  한글 해석 항상 ON, 단어 클릭·삽화 확대·문장 TTS·페이지 TTS 는 유지. */
  mode?: 'full' | 'preview'
}
```

### preview 모드 분기

| 영역 | full | preview |
|---|---|---|
| 좌측 호버 트리거 (`<div className="sb-side-trigger">`) | 렌더 | 미렌더 |
| 사이드 툴바 (`<ViewerToolbar />`) | 렌더 | 미렌더 |
| 우상단 전체화면 (`<div className="sb-float-top">`) | 렌더 | 미렌더 |
| `showTranslation` 초기값 | `false` (기존) | `true` |
| 한글 해석 토글 함수 (`onTranslationToggle`) | 동작 | 호출 경로 자체가 toolbar 안에만 있어 자연 차단 |
| 책갈피 localStorage R/W | 동작 | 미동작 (mode 가드) |
| 책갈피 플래그 (`<div className="sb-bookmark-flag">`) | 조건부 렌더 | 미렌더 |
| 표지 → scene → 뒷표지 페이지 전환 + 3D 플립/fade | 유지 | 유지 |
| 키보드 좌우/Esc | 유지 | 유지 (Esc → onExit() — About 에서 no-op) |
| 문장 클릭 TTS (`speakSentence`) | 유지 | 유지 |
| 페이지 단독 재생 버튼 (BookSpread 인라인) | 유지 | 유지 |
| 단어 클릭 사전 팝업 (`WordLookupCard`) | 유지 | 유지 (요청대로) |
| 삽화 확대 모달 (`IllustrationModal`) | 유지 | 유지 |

### 상태 관리

- `showTranslation` state: 그대로 둔다. `useState(mode === 'preview')` 로 초기화. preview 모드에선 setter 호출 경로가 사라져 (toolbar 가 없으니) 자연스럽게 lock 됨.
- `fontSize` state: 그대로 둔다. `useState(22)` 기본값 유지. preview 모드에선 슬라이더가 없어 22px 고정.
- `bookmark` state, localStorage 읽기/쓰기 useEffect, 자동해제 useEffect: 모두 `mode === 'full'` 가드로 감싼다. preview 모드에선 `bookmark` 가 항상 `null` 이고 localStorage 에 손대지 않음.
- `isToolbarOpen`, `toolbarCloseTimerRef`: preview 모드에선 사이드 트리거가 없어 사용 안 됨. 코드는 그대로 둬도 무해 (open 안 됨).

### About 페이지 호출 변경

```tsx
// 변경 전
<StoryBookViewer story={sampleStory} onExit={() => {}} />

// 변경 후
<StoryBookViewer story={sampleStory} onExit={() => {}} mode="preview" />
```

## 검증 계획

### About 페이지 (`/about`)

- [ ] 좌측 가장자리 호버 → 사이드 툴바 안 나타남
- [ ] 첫 scene 페이지부터 한글 해석이 영문 아래 자동 표시됨
- [ ] 문장 클릭 → 그 문장만 TTS 재생됨, 다른 문장은 재생 안 됨
- [ ] 페이지 안 단독 재생 버튼 클릭 → 페이지 전체 TTS 순차 재생됨
- [ ] 단어 클릭 → 사전 팝업 뜸
- [ ] 삽화 클릭 → 확대 모달 뜸
- [ ] 우상단 전체화면 버튼 없음
- [ ] 좌우 화살표 키 / 좌우 nav 버튼으로 페이지 전환 정상
- [ ] 표지 → scene 전환 시 3D 플립 애니메이션 정상

### 일반 뷰어 회귀 (regression) — `/viewer/:storyId` & `/shared/:token`

- [ ] 좌측 호버 → 사이드 툴바 슬라이드 인
- [ ] 사이드 툴바 안 모든 항목 동작: 전체 자동재생, 일시정지, 이어듣기, 정지, 한글해석 토글, 글자크기 슬라이더, 책갈피 토글, 책갈피로 이동
- [ ] 우상단 전체화면 버튼 동작
- [ ] 책갈피 localStorage 저장/복원/뒷표지 도달 시 자동 해제 정상

### TypeScript / Lint

- [ ] `mode` prop 의 default 동작 (`mode` 안 넘기면 `'full'`) 이 기존 호출처에서 타입 에러 없이 통과
- [ ] tsc / ESLint clean

## 영향 범위 / 위험

- **공개 API 변경** — `StoryBookViewer` 의 props 가 확장됨. `features/viewer/index.ts` 의 export 시그니처는 그대로 (선택 prop 이므로 기존 사용처 깨지지 않음).
- **localStorage 동작 변화 없음** — `mode === 'full'` 일 때만 localStorage 를 읽고 쓰므로 기존 사용자 책갈피는 그대로 보존됨. About 페이지 sample story 는 더 이상 localStorage 를 더럽히지 않음.
- **TTS 훅 (`useStoryTts`) 동작 변화 없음** — preview 모드에서도 동일 인스턴스를 쓰며, 사용자 액션이 줄어드는 것뿐.

## YAGNI / 비범위

- 다른 페이지 (예: 메인 / 책장) 의 미리보기는 본 작업 범위 밖. 동일 패턴이 필요해지면 그때 `mode="preview"` 를 동일하게 적용하면 됨.
- 향후 preview 모드 변형 (예: 단어 클릭 사전 팝업도 끄는 mini 모드) 은 지금은 만들지 않는다. 필요해지면 그때 union 확장.
- BookSpread 자체의 split (full vs preview 페이지 레이아웃) 은 하지 않는다. 한 컴포넌트가 두 모드 모두 잘 렌더하므로 분리 이유가 없다.
