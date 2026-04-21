import { useEffect, useState } from 'react'

/**
 * `/butterfly.json` Lottie 데이터를 앱 시작 시 한 번만 fetch.
 * null 이면 아직 로딩 중 — 나비 렌더 스킵.
 * 실패해도 랜딩 자체는 정상 동작 (no-op).
 */
export function useButterflyAnim(): unknown {
  const [anim, setAnim] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/butterfly.json')
      .then(r => r.json())
      .then((data: unknown) => {
        if (!cancelled) setAnim(data)
      })
      .catch(() => {
        /* no-op: 나비 없이도 랜딩 자체는 동작 */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return anim
}
