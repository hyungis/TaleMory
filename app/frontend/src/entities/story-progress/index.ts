/**
 * 사용자별 동화 뷰어 진행 상태 — 마지막 본 페이지, 책갈피 등.
 */

export interface StoryProgress {
  userId: number
  storyId: number
  lastPageNumber: number
  bookmarks: number[]
  updatedAt: string
}
