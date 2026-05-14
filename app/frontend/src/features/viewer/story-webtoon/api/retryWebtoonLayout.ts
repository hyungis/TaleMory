import type { JobId, StoryId } from '../../../../shared/types'
import { post } from '../../../../shared/api/client'

/**
 * BE `POST /api/stories/{storyId}/webtoon-layout/retry?pageNumber={n}` 호출.
 *
 * WEBTOON 모드에서 좌표 추출이 실패해 scene.characterAnchors 가 비거나 매칭 실패한 페이지를
 * 사용자가 [좌표 다시 추출] 버튼으로 수동 재시도할 때 사용한다.
 * 응답: 새로 발행된 (또는 이미 진행 중이라 재사용된) WEBTOON_LAYOUT_RETRY 잡 메타.
 */
export interface RetryWebtoonLayoutResponse {
  jobId: JobId
  status: string
}

export async function retryWebtoonLayout(
  storyId: StoryId,
  pageNumber: number,
): Promise<RetryWebtoonLayoutResponse> {
  return post<RetryWebtoonLayoutResponse>(
    `/stories/${storyId}/webtoon-layout/retry?pageNumber=${pageNumber}`,
    null,
  )
}
