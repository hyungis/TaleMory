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
   * 잡이 한 번도 enqueue 되지 않았으면 null. FAILED/CANCELLED 잡 id 도 반환 —
   * FE 가 폴링해서 실패 화면을 보여줄 수 있도록 의도된 동작.
   * Step 8 가 TTS jobId 와 함께 동시 폴링한다.
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
