# Storybook Frontend Architecture Guide

## 문서 목적

이 문서는 **영어 동화 제작 서비스 프론트엔드 아키텍처 구조**를 사람이 이해하기 쉽게 정리한 문서다.  
목표는 다음과 같다.

1. 여러 명의 풀스택 개발자가 동시에 작업할 때 충돌을 최소화한다.
2. 기능 간 결합도를 낮추고 변경 영향을 줄인다.
3. 이후 다른 AI에게 이 구조를 그대로 전달해 **skills / AGENTS / 프로젝트 규칙**으로 옮길 수 있게 한다.
4. React 기반 프론트엔드에서 실제로 적용 가능한 폴더 구조와 의존 규칙을 제시한다.

---

# 1. 왜 이 구조가 필요한가

이 서비스는 단순 CRUD 화면 모음이 아니다.  
핵심은 하나의 `storyId`를 중심으로 동화 제작 흐름이 길게 이어지는 **멀티스텝 제작 시스템**이라는 점이다.

대표적인 흐름은 아래와 같다.

- 메인 진입
- 아이 정보 입력
- 사진 업로드
- 스토리 방향 입력
- 스토리 편집
- 스토리보드 확인
- 그림 스타일 선택
- 보이스 설정
- 최종 미리보기
- 결과 화면
- 우리가족 책장
- 동화책 뷰어

즉, 여러 화면이 존재하지만 실제로는 다음과 같은 도메인 구조를 가진다.

- **스토리 제작 도메인**
- **책장 도메인**
- **뷰어 도메인**
- **인증/마이페이지 도메인**

이 구조를 화면별로 단순 분리하면 다음 문제가 생긴다.

- 같은 `storyId`를 공유하는 상태가 여기저기 흩어진다.
- 사진 업로드, 스토리보드 편집, 스타일 선택, 최종 미리보기가 강하게 연결되는데 서로 다른 폴더에 흩어진다.
- 여러 명이 협업할 때 공용 폴더를 동시에 수정하게 되어 충돌이 커진다.
- 전역 상태가 비대해진다.
- 특정 기능 변경이 다른 기능에 연쇄적으로 영향을 준다.

그래서 이 프로젝트는 **화면 중심 구조보다 기능/도메인 중심 구조**가 훨씬 적합하다.

---

# 2. 핵심 설계 원칙

## 2.1 기능 중심(feature-first)으로 나눈다

다음과 같은 기술 폴더 중심 구조는 지양한다.

```text
src/
  components/
  hooks/
  api/
  utils/
  store/
  pages/
```

이 구조는 초반에는 편하지만 프로젝트가 커질수록 다음 문제가 생긴다.

- 어떤 컴포넌트가 어떤 기능 소속인지 알기 어렵다.
- `api` 폴더가 거대해진다.
- `hooks` 폴더가 의미 없이 섞인다.
- 공용처럼 보이는 코드가 사실 특정 기능 전용인 경우가 많다.
- 협업 시 서로 같은 폴더를 계속 건드리게 된다.

따라서 이 프로젝트는 아래 기준으로 나눈다.

- 기술 기준이 아니라 **비즈니스 기능 기준**
- 화면 기준이 아니라 **도메인 기준**
- 공용으로 재사용되는 것만 `shared`
- 나머지는 각 기능 내부에 캡슐화

---

## 2.2 스토리 제작은 하나의 큰 도메인으로 묶는다

이 서비스에서 가장 중요한 부분은 동화 제작 플로우다.  
여러 화면으로 보이지만 프론트 구조상으로는 **하나의 제작 워크스페이스**로 보는 것이 맞다.

따라서 아래 단계들은 최상위 폴더로 각각 독립시키지 않는다.

- 아이 정보 입력
- 사진 업로드
- 스토리 방향 입력
- 스토리 편집
- 스토리보드 확인
- 스타일 선택
- 보이스 설정
- 최종 미리보기
- 공개

이들은 모두 하나의 상위 도메인 아래에 둔다.

- `story-creation`

즉, 이 프로젝트는 다음처럼 본다.

- `story-creation`: 제작 전체
- `bookshelf`: 내가 만든 동화 목록과 관리
- `viewer`: 완성된 동화 열람 및 학습 기능
- `auth`: 로그인/회원가입/OAuth/약관
- `mypage`: 프로필, 인물 관리, 보이스 프로필 관리 등

---

## 2.3 공용(shared)은 최소화한다

공용 폴더는 가장 쉽게 오염되는 영역이다.  
다음과 같은 파일은 `shared`에 두지 않는다.

- 스토리보드 편집 전용 훅
- storyId 기반 제작 상태
- 삽화 재생성 제한 처리
- 보이스 클론 전용 로직
- 뷰어 문장 재생 로직

이런 것은 특정 도메인에 강하게 묶여 있으므로 해당 feature 내부에 둔다.

반대로 다음과 같은 것은 `shared`에 둘 수 있다.

- 공통 API 클라이언트
- 공통 에러 파서
- 공통 응답 래퍼
- 공통 버튼, 모달, 인풋
- 날짜/금액/문자열 포맷 함수
- 공통 폴링 유틸
- 공통 상수
- 라우트 경로 상수

기준은 간단하다.

- 여러 기능에서 실제로 재사용된다 → `shared`
- 특정 기능 맥락이 있어야 의미가 있다 → feature 내부

---

## 2.4 외부에는 public API만 노출한다

각 feature 내부 파일을 다른 곳에서 직접 import 하지 않는다.

좋지 않은 예:

```ts
import { useInternalStoryEditorStore } from "@/features/story-creation/storyboard-editor/model/internal-store";
```

권장 예:

```ts
import { StoryboardEditorPage } from "@/features/story-creation/storyboard-editor";
```

각 feature는 `index.ts`를 두고 외부에는 필요한 컴포넌트/훅/타입만 export 한다.

장점:

- 내부 구조를 바꿔도 외부 영향이 작다.
- 다른 팀원이 내부 파일 경로에 의존하지 않는다.
- 리팩터링이 쉬워진다.

---

## 2.5 의존 방향을 제한한다

모든 레이어가 서로 자유롭게 참조하면 구조는 빠르게 무너진다.  
이 프로젝트는 아래 의존 방향을 기본으로 한다.

- `pages` → `features`, `entities`, `shared`
- `features` → `entities`, `shared`
- `entities` → `shared`
- `shared` → 다른 레이어 참조 금지

즉,

- `shared`는 가장 아래
- `entities`는 도메인 데이터 표현
- `features`는 사용자 행동과 비즈니스 기능
- `pages`는 화면 조립과 라우팅 단위

---

# 3. 최종 권장 폴더 구조

## 3.1 전체 구조

```text
src/
  app/
    providers/
    router/
    layouts/

  pages/
    home/
    auth/
    story-creation/
    bookshelf/
    viewer/
    mypage/

  features/
    story-creation/
      basic-info/
      photo-manager/
      storyboard-editor/
      style-selector/
      voice-clone/
      final-preview/
      publish-story/
      model/
      api/
      index.ts

    bookshelf/
      story-list/
      story-filter/
      story-sort/
      bookmark-story/
      delete-story/
      index.ts

    viewer/
      story-reader/
      tts-player/
      translation/
      word-dictionary/
      progress-bookmark/
      highlight/
      index.ts

    auth/
      login/
      signup/
      oauth/
      terms/
      index.ts

    mypage/
      profile-edit/
      person-manager/
      voice-profile-manager/
      withdrawal/
      index.ts

  entities/
    user/
    person/
    story/
    photo/
    storyboard-page/
    scene/
    sentence/
    voice-profile/
    style-preset/
    bgm-preset/
    story-progress/

  shared/
    api/
    ui/
    lib/
    hooks/
    constants/
    types/
```

---

## 3.2 각 최상위 폴더의 역할

### `app/`
앱 전역 설정과 진입 구성을 담당한다.

예시:
- QueryClientProvider
- Router 설정
- ThemeProvider
- 전역 에러 바운더리
- 레이아웃

이 폴더에는 **도메인 로직을 넣지 않는다**.

---

### `pages/`
라우트 단위 화면이다.  
여기서는 feature들을 조합해서 페이지를 만든다.

예:
- `StoryCreationPage`
- `BookshelfPage`
- `ViewerPage`

페이지는 가급적 얇게 유지한다.

좋은 방향:
- 페이지 = 조립
- 기능 구현 = feature

---

### `features/`
실제 사용자 기능이 들어간다.  
이 프로젝트의 핵심 폴더다.

예:
- 사진 업로드
- 스토리보드 편집
- 스타일 선택
- 보이스 클론
- 책갈피 저장
- 단어 번역
- 즐겨찾기
- 삭제

---

### `entities/`
서비스에서 반복적으로 사용되는 도메인 데이터 단위를 담는다.

예:
- `story`
- `photo`
- `scene`
- `sentence`
- `person`
- `voice-profile`

이 폴더에는 보통 아래가 들어간다.

- 타입 정의
- 도메인 기반 작은 유틸
- 데이터 변환기
- 도메인 모델 관련 뷰 조각

---

### `shared/`
진짜 공용 코드만 둔다.

예:
- 버튼, 모달, 인풋
- API 클라이언트
- 에러 핸들러
- 유틸 함수
- 상수
- 범용 훅

---

# 4. story-creation 도메인 상세 구조

`story-creation`은 이 프로젝트의 중심이다.  
여러 페이지가 있지만 프론트 구조상 하나의 워크스페이스다.

## 4.1 하위 기능 정의

### `basic-info/`
역할:
- 아이 정보 입력
- 여러 아이 추가/삭제
- 영어 레벨 입력
- 여행 날짜 입력
- 기본 스토리 생성 진입

포함 예시:
- 입력 폼 UI
- validation
- 기본 정보 저장 API 연결
- child/person 선택 로직

---

### `photo-manager/`
역할:
- 사진 업로드
- 업로드 목록 조회
- 설명/태그 수정
- 사진 순서 변경

주의:
사진 업로드와 사진 메타데이터 수정은 같은 기능으로 본다.  
단순 `photo-upload`보다 `photo-manager`가 더 정확한 이름이다.

---

### `storyboard-editor/`
역할:
- 스토리 방향 입력
- 스토리보드 생성 요청
- 생성된 스토리 확인
- 페이지별 텍스트 수정
- 페이지별 그림 재생성
- 스토리보드 확정

주의:
이 기능은 동기식 CRUD가 아니라 AI 생성 + 편집 + 확정 흐름이다.  
따라서 생성 상태, 실패 상태, 재시도, 제한 횟수 UI까지 함께 고려해야 한다.

---

### `style-selector/`
역할:
- 스타일 프리셋 조회
- 스타일 미리보기 생성
- 스타일 선택 반영

---

### `voice-clone/`
역할:
- 녹음 스크립트 조회
- 기존 음성 목록 조회
- 음성 녹음 저장
- TTS 미리듣기
- 사용할 보이스 선택

주의:
이 기능은 오디오 녹음, 재생, 업로드, AI 품질 검증 등의 특성이 있으므로 독립성이 높다.

---

### `final-preview/`
역할:
- 최종 장면 조회
- 삽화 수정
- 삽화 롤백
- 문장 강조 음성 설정
- BGM 설정
- 엔딩 문구 수정
- 최종 검토

---

### `publish-story/`
역할:
- 최종 공개
- 공유 링크 조회
- 공개 완료 처리

---

### `model/`
역할:
스토리 제작 플로우 전용 상태를 보관한다.

예:
- 현재 `storyId`
- 현재 step
- 선택된 child/person
- 임시 draft 데이터
- 업로드 완료 여부
- 스토리보드 확정 여부
- 스타일 선택 여부
- 보이스 선택 여부

이 상태는 앱 전체 전역 상태가 아니라 **제작 워크스페이스 전용 상태**다.

---

### `api/`
역할:
`story-creation` 전체에서 반복적으로 쓰이는 API 묶음  
예를 들어 storyId 기반 호출을 정리할 수 있다.

단, 각 하위 기능에서만 쓰는 API는 해당 하위 feature 내부 `api/`에 두는 것도 가능하다.

---

# 5. bookshelf 도메인 상세 구조

책장 기능은 제작 도메인과 별도로 독립성이 높다.

## 하위 기능

### `story-list/`
- 동화 목록 조회
- 목록 렌더링

### `story-filter/`
- 난이도 필터
- 상태 필터 등 확장 가능

### `story-sort/`
- 최신순
- 오래된순
- 이름순

### `bookmark-story/`
- 즐겨찾기 토글

### `delete-story/`
- 삭제 확인
- 삭제 API 호출
- 목록 갱신

책장은 조회/관리 중심이므로 제작 플로우 상태와 섞지 않는다.

---

# 6. viewer 도메인 상세 구조

뷰어는 “완성된 동화 소비 및 학습” 영역이다.  
제작 도메인과 다르게 읽기/재생/학습 경험이 중심이다.

## 하위 기능

### `story-reader/`
- 책 모드 / 웹툰 모드 전환
- 페이지 이동
- 장면 렌더링

### `tts-player/`
- 페이지별 재생
- 전체 읽기
- 문장별 재생
- 일시정지 / 다시 듣기 / 정지

### `translation/`
- 번역 보기
- 문장 단위 번역 표시

### `word-dictionary/`
- 단어 클릭 번역
- 발음/뜻 표시

### `progress-bookmark/`
- 마지막 본 페이지 조회
- 책갈피 저장

### `highlight/`
- 형광펜 저장
- 사용자 학습 흔적 표시

주의:
뷰어는 제작 기능과 다르게 **읽기 경험 최적화**가 중심이므로 별도 도메인으로 유지한다.

---

# 7. auth / mypage 도메인 상세 구조

## `auth/`
포함 기능:
- 로그인
- 회원가입
- OAuth 로그인
- 약관 조회 및 동의

## `mypage/`
포함 기능:
- 사용자 정보 조회/수정
- 인물 정보 관리
- 음성 프로필 관리
- 탈퇴

이 기능들은 제작/책장/뷰어와 분리해도 충분히 독립성이 높다.

---

# 8. entities 설계 원칙

이 프로젝트에서는 다음 entity 분리가 중요하다.

```text
entities/
  story/
  photo/
  storyboard-page/
  scene/
  sentence/
  person/
  voice-profile/
  user/
  style-preset/
  bgm-preset/
  story-progress/
```

## 특히 중요한 구분

### `storyboard-page`와 `scene`은 다르다
둘 다 페이지처럼 보이지만 의미가 다르다.

- `storyboard-page`: 제작 중간 단계 페이지
- `scene`: 최종 동화 장면 페이지

이 둘을 같은 `Page` 타입으로 합치지 않는다.

---

### `scene`과 `sentence`도 분리한다
장면과 문장 단위 기능이 다르다.

- 장면 단위: 삽화, 페이지 이동, 장면 렌더링
- 문장 단위: TTS, 번역, 강조 음성, 말풍선 위치

따라서 타입/컴포넌트/상태도 분리한다.

---

# 9. 상태 관리 원칙

## 9.1 서버 상태와 UI 상태를 분리한다

### 서버 상태
백엔드에서 가져온 데이터
예:
- 스토리 상세
- 사진 목록
- 스타일 프리셋
- 음성 프로필 목록
- 장면 목록
- 책장 목록

이것은 React Query 같은 서버 상태 관리 도구를 쓰는 것이 적합하다.

---

### UI 상태
화면 내부 상호작용 상태
예:
- 모달 열림 여부
- 현재 선택한 탭
- 드래그 상태
- 일시적 입력값
- 선택된 카드

이것은 로컬 state 또는 작은 feature store로 관리한다.

---

### 제작 플로우 상태
여러 step에 걸쳐 유지되는 워크스페이스 상태
예:
- 현재 storyId
- 현재 진행 step
- 작성 중 draft
- 임시 선택 결과

이것은 `story-creation/model`에 둔다.

---

## 9.2 앱 전체 전역 상태는 최소화한다

전역 상태에는 아래 정도만 허용한다.

- 로그인 사용자 정보
- 인증 토큰 상태
- 앱 전체 설정
- 전역 테마/언어 설정

제작 플로우 상태를 앱 전체 전역 store에 넣으면 결합도가 커진다.

---

# 10. API 구조 설계 원칙

## 10.1 API도 기능 소속으로 둔다

하지 말아야 할 구조:

```text
src/api/
  auth.ts
  stories.ts
  photos.ts
  voice.ts
  viewer.ts
```

이 방식은 파일이 빠르게 비대해진다.

권장 방식:

```text
features/
  story-creation/
    photo-manager/api/
    storyboard-editor/api/
    voice-clone/api/
  bookshelf/
    story-list/api/
  viewer/
    word-dictionary/api/
```

단, 아래는 `shared/api`에 둔다.

- API client
- request helper
- response parser
- error mapper
- polling helper

---

## 10.2 공통 응답/에러 규약을 중앙화한다

이 서비스는 응답 형식이 비교적 정형화되어 있다.

예:
- 성공: `{ success, data, message }`
- 실패: `{ success, error }`
- 비동기 시작: `{ jobId, jobType, status }`

따라서 아래 파일이 유용하다.

```text
shared/api/
  client.ts
  request.ts
  response.ts
  error.ts
  job.ts
```

역할 예시:
- `client.ts`: axios/fetch 인스턴스
- `response.ts`: 공통 응답 파싱
- `error.ts`: 에러 코드 매핑
- `job.ts`: job polling 헬퍼

---

# 11. 비동기 AI 작업 처리 원칙

이 프로젝트는 일반적인 동기 요청만 있는 서비스가 아니다.  
스토리 생성, 스토리보드 생성, 삽화 재생성, TTS, 보이스 클론, BGM 같은 AI 작업은 비동기일 수 있다.

따라서 프론트는 아래를 고려해야 한다.

## 11.1 job 상태를 UI 모델로 가져간다

기본 상태 예:
- `idle`
- `pending`
- `running`
- `success`
- `failed`

## 11.2 모든 생성 기능에 동일한 UX 패턴을 적용한다

예:
- 생성 버튼 클릭
- 작업 시작 상태 표시
- 폴링 또는 상태 조회
- 완료 시 데이터 재조회
- 실패 시 에러 안내
- 재시도 버튼 제공

## 11.3 재생성 제한 같은 정책도 feature 내부에서 처리한다

예:
- 전체 10회
- 개별 2회

이 규칙은 단순 공용 유틸이 아니라 해당 기능의 비즈니스 규칙이다.  
따라서 storyboard-editor 또는 final-preview 내부에서 관리한다.

---

# 12. 페이지 설계 원칙

페이지는 feature를 조립하는 역할만 수행한다.

좋은 예:

```tsx
export function StoryCreationPage() {
  return (
    <StoryCreationLayout>
      <StoryCreationStepGuard />
      <StoryCreationContent />
    </StoryCreationLayout>
  );
}
```

피해야 할 예:
- 페이지에서 직접 API 호출 다수 수행
- 페이지에 긴 form validation 로직 작성
- 페이지에 비즈니스 상태 저장
- 페이지에서 하위 기능 여러 개를 직접 제어

즉, 페이지는 얇아야 한다.

---

# 13. feature 내부 권장 구조

각 feature 내부는 아래처럼 가져가면 안정적이다.

```text
feature-name/
  api/
  model/
  ui/
  lib/
  types.ts
  index.ts
```

예시:

```text
storyboard-editor/
  api/
    generateStoryboard.ts
    getStoryboardPages.ts
    patchStoryboardPage.ts
    regenerateStoryboardImage.ts
    confirmStoryboard.ts
  model/
    useStoryboardEditor.ts
    storyboardEditorStore.ts
  ui/
    StoryboardEditor.tsx
    StoryboardGrid.tsx
    StoryboardPageModal.tsx
  lib/
    mapStoryboardResponse.ts
    validateStoryboardEdit.ts
  types.ts
  index.ts
```

---

# 14. 협업을 위한 규칙

## 14.1 팀원 분업 기준

4명이 병렬 작업할 경우 예시:

- A: `story-creation/basic-info`, `photo-manager`
- B: `story-creation/storyboard-editor`, `style-selector`
- C: `story-creation/voice-clone`, `final-preview`, `publish-story`
- D: `bookshelf`, `viewer`, 일부 `mypage`

이렇게 나누면 API 영역과 UI 영역이 비교적 안정적으로 분리된다.

---

## 14.2 shared 수정은 리뷰 강제
`shared`는 영향 범위가 넓으므로 다음 규칙을 둔다.

- shared 수정 시 PR 리뷰 필수
- 공용 컴포넌트 props 변경은 영향 범위 확인
- feature 전용 로직을 shared에 넣지 않기

---

## 14.3 내부 파일 직접 import 금지
다른 feature 내부 파일을 직접 가져오지 않는다.  
반드시 해당 feature의 `index.ts`를 통해 가져온다.

---

## 14.4 타입 이름을 모호하게 짓지 않는다
금지 예:
- `Page`
- `Item`
- `Data`
- `Info`

권장 예:
- `StoryboardPage`
- `Scene`
- `SceneSentence`
- `VoiceProfile`
- `StoryProgress`

---

# 15. 이 구조가 특히 잘 맞는 이유

이 프로젝트는 아래 특성을 가진다.

1. 하나의 `storyId` 중심으로 제작 플로우가 길게 이어진다.
2. 제작 중간 산출물과 최종 산출물이 다르다.
3. AI 생성/재생성/클론/오디오 처리가 많다.
4. 뷰어는 제작과 다른 소비 도메인이다.
5. 협업 인원이 많고 기능 병렬 개발이 중요하다.

따라서 다음이 핵심이다.

- **화면 중심 구조보다 도메인 중심 구조**
- **거대한 전역 store보다 feature별 상태 관리**
- **공용 최소화**
- **public API 강제**
- **AI 비동기 작업 공통 패턴화**

---

# 16. 최종 요약

이 프로젝트의 프론트엔드 구조는 아래 문장으로 요약할 수 있다.

> 이 서비스는 여러 화면의 집합이 아니라, `story-creation`을 중심으로 한 동화 제작 워크스페이스와 `bookshelf`, `viewer`, `auth`, `mypage`로 분리된 도메인형 프론트엔드다.

따라서 다음 원칙을 따른다.

1. 기능/도메인 중심으로 폴더를 나눈다.
2. `story-creation`을 하나의 큰 feature로 묶고 내부를 단계별 기능으로 분리한다.
3. `bookshelf`, `viewer`, `auth`, `mypage`는 독립 도메인으로 둔다.
4. `entities`는 도메인 데이터 단위로 나눈다.
5. `shared`는 진짜 공용만 둔다.
6. 페이지는 얇게 유지하고 feature를 조립만 한다.
7. API와 상태도 기능 소속으로 둔다.
8. AI 비동기 작업을 고려한 공통 UX/로직 패턴을 둔다.
9. 협업 시 feature 경계를 명확히 해서 충돌을 줄인다.

---

# 17. 다른 AI용 전달용 핵심 문장

다른 AI에게 이 구조를 설명할 때는 아래 문장을 기준으로 전달하면 된다.

- 이 프로젝트는 React 프론트엔드이며 기능 중심(feature-first) 구조를 사용한다.
- 최상위 도메인은 `story-creation`, `bookshelf`, `viewer`, `auth`, `mypage`다.
- `story-creation`은 멀티스텝 제작 워크스페이스이며, `basic-info`, `photo-manager`, `storyboard-editor`, `style-selector`, `voice-clone`, `final-preview`, `publish-story`로 나뉜다.
- `storyboard-page`와 `scene`은 서로 다른 도메인 타입이므로 절대 하나로 합치지 않는다.
- `shared`는 최소화하며, feature 전용 로직은 feature 내부에 둔다.
- 외부 import는 feature의 `index.ts`를 통해서만 허용한다.
- `pages`는 라우트 조립 레이어이며 비즈니스 로직을 가지지 않는다.
- 서버 상태와 UI 상태를 분리하고, 제작 플로우 상태는 `story-creation/model`에서 관리한다.
- AI 비동기 작업은 공통 polling / pending / failed UX 패턴을 가진다.

---

# 18. 프로젝트 개발 세팅 / 코드 컨벤션

이 섹션은 아키텍처 규칙과 함께 적용되는 **프로젝트 코드 작성 규칙**이다.  
즉, 폴더 구조와 의존 규칙만 맞추는 것이 아니라, 실제 구현 시 아래 네이밍과 파일 규칙도 함께 따라야 한다.

## 18.1 네이밍 규칙

### 변수명
- **카멜케이스**를 사용한다.

예:
- `storyId`
- `currentPage`
- `selectedVoiceProfile`

금지 예:
- `story_id`
- `CurrentPage`

---

### 함수명
- **동사형**
- **카멜케이스**

예:
- `movePage`
- `uploadPhoto`
- `generateStoryboard`
- `saveBookmark`

금지 예:
- `pageMove`
- `storyboardGenerator`
- `UploadPhoto`

---

### 컴포넌트명
- **파스칼케이스**

예:
- `PhotoUploadSection`
- `StoryboardEditor`
- `ViewerToolbar`

금지 예:
- `photoUploadSection`
- `storyboard-editor`

---

## 18.2 디렉토리 / 파일명 규칙

### 디렉토리명
- **케밥 케이스**

예:
```text
story-creation
photo-manager
voice-clone
word-dictionary
```

금지 예:
```text
storyCreation
PhotoManager
word_dictionary
```

---

### 파일명
- **컴포넌트 파일**: 파스칼케이스
- **그 외 파일**: 카멜케이스

예:
```text
PhotoUploadSection.tsx
StoryboardGrid.tsx
useStoryboardEditor.ts
generateStoryboard.ts
storyboardMapper.ts
routeConfig.ts
```

금지 예:
```text
photo-upload-section.tsx
GenerateStoryboard.ts
storyboard_mapper.ts
```

---

## 18.3 React Query 네이밍 규칙

React Query 관련 함수 및 훅 이름은 HTTP 메서드 의도를 이름에서 드러내야 한다.

### 조회(get)
- 이름 끝에 `Query`를 붙인다.

예:
- `useStoryListQuery`
- `useStoryboardPagesQuery`
- `useVoiceProfilesQuery`

---

### 생성(post)
- 이름 끝에 `Post`를 붙인다.

예:
- `useStoryPost`
- `usePhotoUploadPost`
- `useStoryboardGeneratePost`

---

### 삭제(delete)
- 이름 끝에 `Delete`를 붙인다.

예:
- `useStoryDelete`
- `useBookmarkDelete`

---

### 수정(put / patch 포함 프로젝트 규칙상 update 계열)
- 이름 끝에 `Update`를 붙인다.

예:
- `useStoryStyleUpdate`
- `useStoryProgressUpdate`
- `usePhotoDescriptionUpdate`

---

## 18.4 권장 네이밍 적용 예시

### feature 폴더 예시
```text
features/
  story-creation/
    photo-manager/
      api/
        uploadPhotoPost.ts
        updatePhotoDescription.ts
      model/
        usePhotoUploadPost.ts
        usePhotoListQuery.ts
      ui/
        PhotoUploadSection.tsx
        PhotoList.tsx
```

### viewer 예시
```text
features/
  viewer/
    progress-bookmark/
      api/
        updateStoryProgress.ts
      model/
        useStoryProgressQuery.ts
        useStoryProgressUpdate.ts
      ui/
        BookmarkButton.tsx
```

---

## 18.5 이 아키텍처와 컨벤션을 함께 적용하는 방식

이 프로젝트에서는 아래 두 가지를 항상 동시에 만족해야 한다.

### 1. 구조 규칙
- 기능/도메인 중심 폴더 구조를 사용한다.
- `story-creation`, `bookshelf`, `viewer`, `auth`, `mypage` 중심으로 분리한다.
- `shared`는 최소화한다.
- 외부 import는 각 feature의 `index.ts`를 통해서만 수행한다.

### 2. 코드 작성 규칙
- 변수명과 함수명은 카멜케이스
- 함수명은 동사형
- 컴포넌트명은 파스칼케이스
- 디렉토리명은 케밥 케이스
- 컴포넌트 파일은 파스칼케이스
- 나머지 파일은 카멜케이스
- React Query 이름은 `Query / Post / Delete / Update` 규칙을 따른다

즉, 올바른 예시는 다음과 같다.

```text
features/
  story-creation/
    final-preview/
      ui/
        FinalPreviewPanel.tsx
      model/
        useSceneListQuery.ts
        useIllustrationRegeneratePost.ts
        useBgmUpdate.ts
      api/
        getSceneList.ts
        postIllustrationRegenerate.ts
        updateBgm.ts
```

이런 조합은 허용된다.

반대로 아래는 구조나 네이밍이 어긋난 예다.

```text
features/
  storyCreation/
    FinalPreview/
      ui/
        final-preview-panel.tsx
      model/
        SceneListQuery.ts
```

문제점:
- 디렉토리명이 케밥 케이스가 아님
- 컴포넌트 파일이 파스칼케이스가 아님
- Query 파일명이 프로젝트 규칙과 맞지 않음
- feature 네이밍이 통일되지 않음

---

## 18.6 다른 AI에게 전달할 때의 핵심 규칙

다른 AI에게 이 프로젝트의 규칙을 전달할 때는 아래를 함께 전달해야 한다.

- 아키텍처는 **기능/도메인 중심(feature-first)** 이다.
- 최상위 도메인은 `story-creation`, `bookshelf`, `viewer`, `auth`, `mypage`다.
- 디렉토리명은 **케밥 케이스**다.
- 컴포넌트명과 컴포넌트 파일명은 **파스칼케이스**다.
- 변수명과 함수명은 **카멜케이스**다.
- 함수명은 **동사형**이다.
- 일반 파일명은 **카멜케이스**다.
- React Query 이름은 다음 규칙을 따른다.
  - 조회: `Query`
  - 생성: `Post`
  - 삭제: `Delete`
  - 수정: `Update`

이 규칙은 아키텍처 규칙과 별개가 아니라, **같은 레벨의 프로젝트 규칙**으로 함께 적용한다.
