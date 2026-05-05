import { useEffect, useState } from 'react'
import { getSampleStoryView } from '../api/getSampleStoryView'
import type { StoryView } from './types'

type Status = 'idle' | 'loading' | 'success' | 'error'

export interface SampleStoryViewQueryResult {
  status: Status
  data: StoryView | null
}

export function useSampleStoryViewQuery(): SampleStoryViewQueryResult {
  const [status, setStatus] = useState<Status>('idle')
  const [data, setData] = useState<StoryView | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    getSampleStoryView()
      .then(result => {
        if (cancelled) return
        setData(result)
        setStatus('success')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { status, data }
}
