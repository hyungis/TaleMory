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

/**
 * 스토리보드 편집 단계에서 아직 서버에 확정되지 않은 draft 페이지.
 * `StoryboardPage` 와 다르게 id/storyBoardId 등 영속 식별자가 없고,
 * UI 표현용 icon 키와 sketch 설명을 가진다.
 * story-creation(편집) 과 viewer(미리보기) 양쪽에서 공유되는 도메인 어휘이므로
 * feature 가 아니라 entity 에 둔다.
 */
export interface StoryboardPageDraft {
  icon: string
  sketch: string
  en: string
  ko: string
}
