/**
 * 동화 제작 워크스페이스 전역 상태 타입.
 * 원본 App.jsx 의 `projectData` 스키마와 호환 (localStorage 마이그레이션 용이).
 * 추후 백엔드 연동 시 id, storyId 등 필드 확장 예정.
 */

export type Gender = '남자' | '여자'
export type Level = '초급' | '중급' | '고급'

export interface ChildInfo {
  name: string
  gender: Gender
  age: string
}

export interface PhotoItem {
  id: string
  url: string
  name: string
  /** 사용자가 붙이는 한 줄 설명 (선택). 원본 App.jsx 스키마 맞춤. */
  description: string
  /** 해시태그 자유 텍스트. 예: "#제주도 #여름휴가 #해솔이첫바다". 배열 아님. */
  tags: string
}

export interface StoryboardPageDraft {
  icon: string
  sketch: string
  en: string
  ko: string
}

export type StylePreset = 'watercolor' | 'digital' | 'crayon' | 'line' | 'collage'

export interface ProjectData {
  step1: {
    children: ChildInfo[]
    companions: string
    level: Level
    travelDates: string[]
    location: string
  }
  step2: {
    photos: PhotoItem[]
    prompt: string
  }
  step3: {
    story: string
  }
  step4: {
    pages: StoryboardPageDraft[]
  }
  step5: {
    style: StylePreset
  }
  step6: {
    /** 저장된 보이스 프로필 식별명 (사용자가 "엄마 제주 동화 목소리" 등으로 지정). null = 아직 저장 안 됨. */
    voiceModel: string | null
  }
}

/** 마지막 step index (0..N) — 원본은 0..8 (책장, 1~5 제작, 6 보이스, 7 미리보기, 8 공개). */
export const MAX_STEP = 8
