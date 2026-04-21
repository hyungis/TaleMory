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
  tags: string[]
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
    voiceModel: unknown
  }
}

/** 마지막 step index (0..N) — 원본은 0..8 (책장, 1~5 제작, 6 보이스, 7 미리보기, 8 공개). */
export const MAX_STEP = 8
