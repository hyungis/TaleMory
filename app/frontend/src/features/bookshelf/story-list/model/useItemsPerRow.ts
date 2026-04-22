import { useEffect, useState } from 'react'

/**
 * 화면 너비에 따른 한 선반당 표시 책 수를 반환.
 * 원본 story-forest 와 동일한 브레이크포인트 (XL 4, LG 3, SM 2, else 1).
 *
 * 왜 Tailwind responsive 만으로 안 되는가?
 *   - 각 "선반" 은 고정 개수의 책을 담는 행으로 그룹핑 되어야 하고
 *   - 그 위에 나무 상판/브래킷 decorative 요소가 row 단위로 따라 붙어야 한다
 *   → rows 를 JS 에서 직접 chunk 해야 해서 itemsPerRow 수치 자체가 필요하다.
 */
export function useItemsPerRow(): number {
  const [width, setWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  )

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (width >= 1280) return 4
  if (width >= 1024) return 3
  if (width >= 640) return 2
  return 1
}
