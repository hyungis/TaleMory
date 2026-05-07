import { get } from '../../../../shared/api'
import type { StoryboardImageVersionsResponse } from './types'
import type { StoryId } from '../../../../shared/types'

/**
 * `GET /api/stories/{storyId}/storyboard/pages/{pageNumber}/image/versions` —
 * 한 페이지의 이미지 버전 list + current 조회.
 *
 * 재생성 이력 없는 페이지는 `versions = [], current = null` 로 200 응답.
 * FE 는 versions.length === 0 이면 picker 자체를 숨긴다.
 */
export function getStoryboardPageImageVersions(
  storyId: StoryId,
  pageNumber: number,
): Promise<StoryboardImageVersionsResponse> {
  return get<StoryboardImageVersionsResponse>(
    `/stories/${storyId}/storyboard/pages/${pageNumber}/image/versions`,
  )
}
