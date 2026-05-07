import { get } from '../../../../shared/api'
import type { GenerationJobResponse } from './types'
import type { JobId } from '../../../../shared/types'

/**
 * 명세 #56 — 생성 작업 상세 조회 (FE polling 대상).
 *
 * status 가 `SUCCESS` 면 `resultPayload` 가, `FAILED` 면 `errorMessage` 가 채워져 내려온다.
 */
export function getGenerationJob(jobId: JobId): Promise<GenerationJobResponse> {
  return get<GenerationJobResponse>(`/generation-jobs/${jobId}`)
}
