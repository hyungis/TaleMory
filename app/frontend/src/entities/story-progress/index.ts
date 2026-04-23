/**
 * 사용자별 동화 뷰어 진행 상태 — 책갈피(1개) + 마지막 읽은 페이지.
 * BE `story_progress` 테이블 스키마와 정렬 — 한 동화당 한 명이 하나의 책갈피만 가질 수 있음.
 */

export interface StoryProgress {
  userId: number
  storyId: number
  /** 유저가 저장한 책갈피 페이지 (scene pageNumber 기준). 없으면 null. */
  lastScenePage: number | null
  updatedAt: string
}
