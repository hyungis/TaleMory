import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export interface UseHouseWalkOptions {
  /**
   * 문 앞 도착 후 `lingerMs` 뒤에 호출. 씬 전환(bookstore 로) 트리거 지점.
   * Task 1b 에서는 제공하지 않으면 씬 전환 없이 상태만 초기화.
   */
  onArrive?: () => void
  /** 걷기 애니메이션 총 시간(ms). 기본 1500. */
  walkMs?: number
  /** 도착 직후 onArrive 호출까지 대기(ms). 기본 400. */
  lingerMs?: number
  /** onArrive 호출 이후 isKidWalking/showBackView 초기화까지 대기(ms). 기본 800. */
  cleanupMs?: number
}

export interface UseHouseWalkResult {
  isKidWalking: boolean
  showBackView: boolean
  /** kid-character 컨테이너 div 에 부착. RAF 로 inline transform 직접 조작. */
  kidRef: RefObject<HTMLDivElement | null>
  /** 집 클릭 핸들러에서 호출. 이미 걷고 있으면 no-op. */
  startWalking: () => void
}

/**
 * 집 클릭 시 아이가 문 앞까지 수평 이동하며 문이 열리는 state machine.
 *
 * 동작 흐름:
 *   1. startWalking() → setIsKidWalking(true) → Lottie 옆걸음 재생
 *   2. RAF 매 프레임 `translate()` inline style 로 `translate(0vw → 25vw, 0vh) scale(0.9)`
 *   3. progress === 1 도달 시 setShowBackView(true) → Lottie → boy.png 뒷모습 스왑
 *   4. lingerMs 뒤 onArrive() 호출 (씬 전환 훅 포인트)
 *   5. lingerMs + cleanupMs 뒤 isKidWalking/showBackView 초기화 (inline transform 도 effect 로 해제)
 */
export function useHouseWalk({
  onArrive,
  walkMs = 1500,
  lingerMs = 400,
  cleanupMs = 800,
}: UseHouseWalkOptions = {}): UseHouseWalkResult {
  const [isKidWalking, setIsKidWalking] = useState(false)
  const [showBackView, setShowBackView] = useState(false)
  const kidRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const startWalking = useCallback(() => {
    if (isKidWalking) return
    setIsKidWalking(true)

    const start = { x: 0, y: 0, scale: 0.9 }
    const end = { x: 25, y: 0, scale: 0.9 }
    const t0 = performance.now()
    let arrived = false

    const tick = (now: number) => {
      const progress = Math.min((now - t0) / walkMs, 1)
      const x = start.x + (end.x - start.x) * progress
      const y = start.y + (end.y - start.y) * progress
      const scale = start.scale + (end.scale - start.scale) * progress

      if (kidRef.current) {
        kidRef.current.style.transform = `translate(${x}vw, ${y}vh) scale(${scale})`
      }

      if (!arrived && progress >= 1) {
        arrived = true
        setShowBackView(true)

        setTimeout(() => {
          onArrive?.()
        }, lingerMs)
        setTimeout(() => {
          setIsKidWalking(false)
          setShowBackView(false)
        }, lingerMs + cleanupMs)
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [isKidWalking, walkMs, lingerMs, cleanupMs, onArrive])

  // 언마운트 시 RAF 정리
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // 걷기 종료 시 inline transform/opacity/filter 해제 → CSS 기본값으로 복귀
  useEffect(() => {
    if (!isKidWalking && kidRef.current) {
      kidRef.current.style.transform = ''
      kidRef.current.style.opacity = ''
      kidRef.current.style.filter = ''
    }
  }, [isKidWalking])

  return { isKidWalking, showBackView, kidRef, startWalking }
}
