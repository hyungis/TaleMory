import { post } from '../../../../shared/api'

export interface ConfirmStoryboardResponse {
  jobId: number
  jobType: 'TTS'
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  sceneCount: number
  sentenceCount: number
  cacheHits: number
  cacheMisses: number
  /**
   * Step 5 PATCH /style 시점에 enqueue 된 FINAL_ILLUSTRATION 잡 id.
   * SUCCESS/RUNNING 상태의 잡이 있으면 그 id, 그 외(없음/FAILED/CANCELLED)면 null.
   * Step 8 가 TTS jobId 와 함께 동시 폴링하는 데 사용한다.
   */
  finalIllustrationJobId: number | null
}

/**
 * TTS 생성 confirm trigger — `POST /api/stories/{storyId}/storyboard/confirm`.
 *
 * 202 Accepted + `{ jobId, jobType, status, sceneCount, sentenceCount, cacheHits, cacheMisses }` 반환.
 * 호출부는 응답 jobId 를 가지고 polling 한다.
 */
export function postStoryboardConfirm(storyId: number): Promise<ConfirmStoryboardResponse> {
  return post<ConfirmStoryboardResponse>(`/stories/${storyId}/storyboard/confirm`)
}
