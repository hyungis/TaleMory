import { useEffect, useState } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { getGenerationJob } from '../api/getGenerationJob'
import type { GenerationJobResponse, JobStatusApi } from '../api/types'

const POLLING_INTERVAL_MS = 3_000
/**
 * AI 워커가 예기치 못한 크래시(OOM/네트워크 단절/무한 루프 등)로 결과를 돌려주지 못해
 * DB job 이 PENDING/RUNNING 에 박제되는 경우 FE 가 무한 polling 에 갇히는 걸 막는 상한선.
 * 실제 OpenAI 호출은 보통 30초 내 완료되므로 3분이면 충분한 마진.
 * 후속 이슈: BE 측 스케줄러가 오래된 PENDING 을 FAILED 로 전이하면 이 값이 의미하는 맥락이 작아짐.
 */
const MAX_POLLING_DURATION_MS = 3 * 60 * 1000

const FINAL_STATUSES: JobStatusApi[] = ['SUCCESS', 'FAILED', 'CANCELLED']

export type GenerationJobQueryResult = UseQueryResult<GenerationJobResponse, ApiError> & {
  /** 최대 폴링 시간(3분) 경과. true 가 되면 query 는 enabled=false 로 전환되고 UI 는 timeout 안내. */
  isTimedOut: boolean
}

/**
 * 생성 작업 상태 polling 훅 — `GET /generation-jobs/{jobId}`.
 *
 * - `jobId === null` 이면 disabled.
 * - 3초 간격 `refetchInterval` — 종결 상태(SUCCESS/FAILED/CANCELLED) 도달 시 자동 중지.
 * - `jobId` 세팅 시점부터 3분 경과하면 `isTimedOut=true` 로 폴링 종료 (AI 크래시 방어).
 * - `staleTime: 0` — 폴링 중에는 매번 fresh 하게 받는다.
 */
export function useGenerationJobQuery(jobId: number | null): GenerationJobQueryResult {
  const [isTimedOut, setIsTimedOut] = useState(false)

  // jobId 가 새로 설정되면 타임아웃 타이머 시작 / 초기화.
  useEffect(() => {
    setIsTimedOut(false)
    if (jobId === null) return
    const timer = window.setTimeout(() => setIsTimedOut(true), MAX_POLLING_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [jobId])

  const query = useQuery<GenerationJobResponse, ApiError>({
    queryKey: ['generation-job', jobId],
    queryFn: () => getGenerationJob(jobId as number),
    enabled: jobId !== null && !isTimedOut,
    refetchInterval: q => {
      if (isTimedOut) return false
      const status = q.state.data?.status
      if (status && FINAL_STATUSES.includes(status)) return false
      return POLLING_INTERVAL_MS
    },
    staleTime: 0,
  })

  return Object.assign(query, { isTimedOut })
}
