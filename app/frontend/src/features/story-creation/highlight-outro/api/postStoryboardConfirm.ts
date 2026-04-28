import { post } from '../../../../shared/api'

export interface ConfirmStoryboardResponse {
  jobId: number
  jobType: 'TTS'
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  sceneCount: number
  sentenceCount: number
  cacheHits: number
  cacheMisses: number
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
