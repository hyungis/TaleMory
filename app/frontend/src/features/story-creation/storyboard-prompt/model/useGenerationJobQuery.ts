import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { getGenerationJob } from '../api/getGenerationJob'
import type { GenerationJobResponse, JobStatusApi } from '../api/types'

const POLLING_INTERVAL_MS = 3_000

const FINAL_STATUSES: JobStatusApi[] = ['SUCCESS', 'FAILED', 'CANCELLED']

/**
 * 생성 작업 상태 polling 훅 — `GET /generation-jobs/{jobId}`.
 *
 * - `jobId === null` 이면 disabled. `useGenerateStoryboardStoryPost` mutation 이
 *   성공해 jobId 가 세팅되면 자동으로 polling 시작.
 * - 3초 간격 `refetchInterval` — 종결 상태(SUCCESS/FAILED/CANCELLED) 도달 시 자동 중지.
 * - `staleTime: 0` — 폴링 중에는 매번 fresh 하게 받는다.
 */
export function useGenerationJobQuery(
  jobId: number | null,
): UseQueryResult<GenerationJobResponse, ApiError> {
  return useQuery<GenerationJobResponse, ApiError>({
    queryKey: ['generation-job', jobId],
    queryFn: () => getGenerationJob(jobId as number),
    enabled: jobId !== null,
    refetchInterval: query => {
      const status = query.state.data?.status
      if (status && FINAL_STATUSES.includes(status)) return false
      return POLLING_INTERVAL_MS
    },
    staleTime: 0,
  })
}
