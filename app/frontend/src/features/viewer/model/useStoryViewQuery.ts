import { useEffect, useState } from 'react'
import type { StoryId } from '../../../shared/types'
import { getStoryView } from '../api'
import type { StoryView } from './types'

/**
 * 뷰어 상세 데이터 조회 훅.
 * TanStack Query 미도입 상태라 useState + useEffect 로 간단히 구현.
 * 추후 `@tanstack/react-query` 도입 시 `useQuery` 로 교체 — API 경계(getStoryView)는 그대로.
 */

type Status = 'idle' | 'loading' | 'success' | 'error'

export interface StoryViewQueryResult {
  status: Status
  data: StoryView | null
  error: Error | null
}

export function useStoryViewQuery(storyId: StoryId | undefined): StoryViewQueryResult {
  const [status, setStatus] = useState<Status>('idle')
  const [data, setData] = useState<StoryView | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!storyId) return
    let cancelled = false
    setStatus('loading')
    setError(null)

    getStoryView(storyId)
      .then(result => {
        if (cancelled) return
        setData(result)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [storyId])

  return { status, data, error }
}
