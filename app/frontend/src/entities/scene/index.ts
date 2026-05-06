/**
 * 최종 동화 장면 엔티티 — `scenes` 테이블 대응.
 * 제작 중간 산출물인 `storyboard-page` 엔티티와 절대 합치지 말 것 (FE 컨벤션).
 */

export interface CharacterAnchor {
  characterId: number
  x: number
  y: number
  scale?: number
}

export interface Scene {
  id: number
  storyId: number
  pageNumber: number
  illustrationUrl: string
  characterAnchors: CharacterAnchor[]
}
