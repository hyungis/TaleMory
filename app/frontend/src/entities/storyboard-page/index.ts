/**
 * 제작 중간 산출물 — `storyboard_pages` 테이블 대응.
 * ⚠ 최종 Scene 과 타입을 합치지 말 것 (FE 컨벤션).
 */

export interface StoryboardPage {
  id: number
  storyBoardId: number
  pageNumber: number
  englishText: string
  koreanText: string
  imageUrl?: string
}
