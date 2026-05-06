import { useEffect, useState } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { getGenerationJob } from '../api/getGenerationJob'
import type { GenerationJobResponse, JobStatusApi } from '../api/types'

// BE 가 cache-aside (Redis 10분 TTL) 로 polling read 부담을 흡수하므로 3s 가 아닌 5s 로 완화.
// 진행 중 잡은 캐시 hit 위주라 사용자가 체감하는 응답성은 거의 동일.
const POLLING_INTERVAL_MS = 5_000
/**
 * AI 워커가 예기치 못한 크래시(OOM/네트워크 단절/무한 루프 등)로 결과를 돌려주지 못해
 * DB job 이 PENDING/RUNNING 에 박제되는 경우 FE 가 무한 polling 에 갇히는 걸 막는 상한선.
 * 최종 삽화(FINAL_ILLUSTRATION) 잡은 페이지 수에 따라 수 분~수십 분 소요될 수 있어 1시간으로 설정.
 */
const MAX_POLLING_DURATION_MS = 60 * 60 * 1000

const FINAL_STATUSES: JobStatusApi[] = ['SUCCESS', 'FAILED', 'CANCELLED']

export type GenerationJobQueryResult = UseQueryResult<GenerationJobResponse, ApiError> & {
  /** 최대 폴링 시간(5분) 경과. true 가 되면 query 는 enabled=false 로 전환되고 UI 는 timeout 안내. */
  isTimedOut: boolean
}

/**
 * 생성 작업 상태 polling 훅 — `GET /generation-jobs/{jobId}`.
 *
 * - `jobId === null` 이면 disabled.
 * - 5초 간격 `refetchInterval` — 종결 상태(SUCCESS/FAILED/CANCELLED) 도달 시 자동 중지.
 * - `jobId` 세팅 시점부터 5분 경과하면 `isTimedOut=true` 로 폴링 종료 (AI 크래시 방어).
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
