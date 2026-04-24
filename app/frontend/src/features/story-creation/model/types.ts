/**
 * 동화 제작 워크스페이스 전역 상태 타입.
 * 원본 App.jsx 의 `projectData` 스키마와 호환 (localStorage 마이그레이션 용이).
 * 추후 백엔드 연동 시 id, storyId 등 필드 확장 예정.
 *
 * 네이밍 규칙(FE 컨벤션 14.4):
 *  - `Info / Item / Data / Page` 금지 접미사 회피.
 *  - 도메인 공용 어휘인 `StoryboardPageDraft`, `StylePresetCode` 는 `entities/` 에서 재사용.
 */

import type { StoryboardPageDraft, StylePresetCode } from '../../../entities'

export type { StoryboardPageDraft, StylePresetCode }

export type Gender = '남자' | '여자'
export type Level = '초급' | '중급' | '고급'

/** 제작 플로우에서 다루는 아이(캐릭터) 기본 정보. */
export interface StoryChild {
  name: string
  gender: Gender
  age: string
  /**
   * persons 테이블에 이미 저장된 인물이면 해당 PK.
   *  - 드롭다운으로 기존 인물 선택 시 세팅 → step 1 종료 때 재사용(재등록 안 함)
   *  - 사용자가 직접 입력한 신규 아이면 undefined → step 1 종료 때 POST /api/persons 로 먼저 등록
   */
  personId?: number
}

/** 사진 업로드 단계에서 클라이언트가 쥐고 있는 draft 사진 (서버 `Photo` 와 별개). */
export interface DraftPhoto {
  id: string
  url: string
  name: string
  /** 사용자가 붙이는 한 줄 설명 (선택). 원본 App.jsx 스키마 맞춤. */
  description: string
  /** 해시태그 자유 텍스트. 예: "#제주도 #여름휴가 #해솔이첫바다". 배열 아님. */
  tags: string
}

/** 제작 워크스페이스 전역 state. 8개 step 의 작성 중 값을 모두 가진다. */
export interface StoryProject {
  step1: {
    children: StoryChild[]
    companions: string
    level: Level
    travelDates: string[]
    location: string
  }
  step2: {
    photos: DraftPhoto[]
    prompt: string
  }
  step3: {
    story: string
  }
  step4: {
    pages: StoryboardPageDraft[]
  }
  step5: {
    style: StylePresetCode
  }
  step6: {
    /** 저장된 보이스 프로필 식별명 (사용자가 "엄마 제주 동화 목소리" 등으로 지정). null = 아직 저장 안 됨. */
    voiceModel: string | null
  }
}

/** 마지막 step index (0..N) — 원본은 0..8 (책장, 1~5 제작, 6 보이스, 7 미리보기, 8 공개). */
export const MAX_STEP = 8
