import { useCallback, useEffect, useState } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { getStoryboardSummary } from '../api/getStoryboardSummary'
import type { SummaryJobStatus, SummaryResponseData } from '../api/types'

// BE 가 cache-aside (Redis 10분 TTL) 로 polling read 부담을 흡수하므로 3s 가 아닌 5s 로 완화.
// 진행 중 잡은 캐시 hit 위주라 사용자가 체감하는 응답성은 거의 동일.
const POLLING_INTERVAL_MS = 5_000
/**
 * AI 워커 크래시로 잡이 PENDING/RUNNING 에 박제되는 경우 무한 polling 을 막는 상한선.
 * 실제 OpenAI 호출은 보통 30초 ~ 1분 내 완료되므로 5분 마진이면 충분.
 */
const MAX_POLLING_DURATION_MS = 5 * 60 * 1000

const ACTIVE_STATUSES: SummaryJobStatus[] = ['PENDING', 'RUNNING']

export type StoryboardSummaryQueryResult = UseQueryResult<SummaryResponseData, ApiError> & {
  /** 최대 폴링 시간(5분) 경과. true 가 되면 query 는 enabled=false 로 전환되고 UI 는 timeout 안내. */
  isTimedOut: boolean
  /**
   * 사용자가 "다시 시도하기" 등 명시적 재진입을 할 때 호출.
   * isTimedOut 을 false 로 풀어서 polling 을 다시 enable.
   *
   * 왜 필요한가:
   *  isTimedOut=true → enabled=false → polling 정지 → query.data 정체 → isActive 정체 →
   *  useEffect 의존성 unchanged → setIsTimedOut(false) 영원히 호출 안 됨 (deadlock).
   *  명시적 reset 으로 이 cycle 을 깨고 BE 의 최신 상태를 다시 받는다.
   */
  resetTimeout: () => void
}

/**
 * 줄거리(요약) 상태 polling 훅 — `GET /stories/{storyId}/storyboard/summary`.
 *
 * - storyId === null → disabled.
 * - jobStatus 가 PENDING/RUNNING 일 때만 5초 refetch. SUCCESS/FAILED/null 이면 polling 중단.
 * - PENDING/RUNNING 진입 시점부터 5분 경과 시 `isTimedOut=true` 로 polling 종료.
 *   `null → PENDING` 또는 `SUCCESS → PENDING (재생성)` 같은 transition 에 맞춰 타이머 reset.
 * - staleTime: 0 — polling 중에는 매번 fresh.
 */
export function useStoryboardSummaryQuery(storyId: number | null): StoryboardSummaryQueryResult {
  const [isTimedOut, setIsTimedOut] = useState(false)

  const query = useQuery<SummaryResponseData, ApiError>({
    queryKey: ['storyboard-summary', storyId],
    queryFn: () => getStoryboardSummary(storyId as number),
    enabled: storyId !== null && !isTimedOut,
    refetchInterval: q => {
      if (isTimedOut) return false
      const status = q.state.data?.jobStatus
      if (status && ACTIVE_STATUSES.includes(status)) return POLLING_INTERVAL_MS
      return false
    },
    staleTime: 0,
  })

  // PENDING/RUNNING 진입 시점에 5분 카운트 시작 — `useGenerationJobQuery` 의 jobId 기반 패턴을
  // status 진입 단위로 옮긴 형태. status 가 종결 상태(SUCCESS/FAILED/null) 로 가면 타이머 cleanup.
  // 의존성을 status 로 좁혀 background refetch 의 ref 변화 폭주를 막는다.
  const status = query.data?.jobStatus ?? null
  const isActive = status !== null && ACTIVE_STATUSES.includes(status)
  useEffect(() => {
    if (!isActive) {
      setIsTimedOut(false)
      return
    }
    setIsTimedOut(false)
    const timer = window.setTimeout(() => setIsTimedOut(true), MAX_POLLING_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [isActive])

  const resetTimeout = useCallback(() => {
    setIsTimedOut(false)
  }, [])

  return Object.assign(query, { isTimedOut, resetTimeout })
}
