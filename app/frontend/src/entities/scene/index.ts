/**
 * 최종 동화 장면 엔티티 — `scenes` 테이블 대응.
 * 제작 중간 산출물인 `storyboard-page` 엔티티와 절대 합치지 말 것 (FE 컨벤션).
 */
import type { PersonId, SceneId, StoryId } from '../../shared/types'

export interface CharacterAnchor {
  characterId: PersonId
  x: number
  y: number
  scale?: number
}

export interface Scene {
  id: SceneId
  storyId: StoryId
  pageNumber: number
  illustrationUrl: string
  characterAnchors: CharacterAnchor[]
}
