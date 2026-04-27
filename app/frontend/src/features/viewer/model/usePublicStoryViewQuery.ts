import { useEffect, useState } from 'react'
import { getPublicStoryView } from '../api/getPublicStoryView'
import type { StoryView } from './types'

type Status = 'idle' | 'loading' | 'success' | 'error'

export interface PublicStoryViewQueryResult {
  status: Status
  data: StoryView | null
  error: Error | null
}

export function usePublicStoryViewQuery(shareToken: string | undefined): PublicStoryViewQueryResult {
  const [status, setStatus] = useState<Status>('idle')
  const [data, setData] = useState<StoryView | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!shareToken) return
    let cancelled = false
    setStatus('loading')
    setError(null)

    getPublicStoryView(shareToken)
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
  }, [shareToken])

  return { status, data, error }
}
