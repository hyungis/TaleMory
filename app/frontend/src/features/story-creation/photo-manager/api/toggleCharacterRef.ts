import { put } from '../../../../shared/api'
import type { CharacterRefToggleRequest, PhotoItemResponse } from './types'

/**
 * 추억 사진 카드의 별 토글 — `STORYBOARD` ↔ `BOTH`.
 *
 * `on=true` : purpose 를 `BOTH` 로 (해당 사진을 reference 로도 사용).
 * `on=false`: purpose 를 `STORYBOARD` 로 되돌림.
 *
 * 별도 업로드된 `CHARACTER_REF` 사진은 토글 대상이 아니므로 BE 가 거부 (400).
 *
 * 에러 케이스:
 *  - `STORY_021` (409): 첫 STORYBOARD_IMAGE 배치 시작 후 → lock 으로 변경 불가
 *  - `STORY_020` (400): on=true 인데 합산 max 3 초과
 *  - `STORY_003` 등: 잘못된 photoId / purpose
 */
export function toggleCharacterRef(
  storyId: number,
  photoId: number,
  body: CharacterRefToggleRequest,
): Promise<PhotoItemResponse> {
  return put<PhotoItemResponse>(
    `/stories/${storyId}/photos/${photoId}/character-ref-toggle`,
    body,
  )
}
