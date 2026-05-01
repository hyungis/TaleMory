import { post } from '../../../../shared/api'
import type {
  SelectStoryboardImageVersionRequest,
  StoryboardPageItem,
} from './types'

/**
 * `POST /api/stories/{storyId}/storyboard/pages/{pageNumber}/image/select` —
 * 유저가 드롭다운에서 특정 버전을 골랐을 때.
 *
 * BE 동작:
 *  - `storyboard_pages.image_url` 을 해당 버전 URL 로 갱신 (DB SOT).
 *  - Redis `current` 도 같은 버전 번호로 set.
 *  - 응답으로 갱신된 단건 페이지(`StoryboardPageItem`) 반환 → FE 는 그대로 캐시 patch 가능.
 */
export function postSelectStoryboardPageImageVersion(
  storyId: number,
  pageNumber: number,
  body: SelectStoryboardImageVersionRequest,
): Promise<StoryboardPageItem> {
  return post<StoryboardPageItem>(
    `/stories/${storyId}/storyboard/pages/${pageNumber}/image/select`,
    body,
  )
}
