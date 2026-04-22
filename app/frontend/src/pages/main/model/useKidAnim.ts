import { useEffect, useState } from 'react'

/**
 * `/kid-walking.json` Lottie 데이터를 한 번만 fetch.
 * null 이면 아직 로딩 중 — 걷는 아이 Lottie 렌더 스킵 (집 클릭은 여전히 작동).
 */
export function useKidAnim(): unknown {
  const [anim, setAnim] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/kid-walking.json')
      .then(r => r.json())
      .then((data: unknown) => {
        if (!cancelled) setAnim(data)
      })
      .catch(() => {
        /* no-op: Lottie 없이도 씬 자체는 동작 */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return anim
}
