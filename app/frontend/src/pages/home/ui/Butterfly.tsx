import { memo, useEffect, useMemo } from 'react'
import { useLottie } from 'lottie-react'

interface ButterflyProps {
  /** `/butterfly.json` 에서 받은 Lottie 데이터. null 이면 렌더 스킵. */
  animationData: unknown
  /** 개별 개체 색감 분리를 위한 hue-rotate(deg) 값 */
  hue: number
  /** Lottie 재생 속도 */
  speed: number
}

/**
 * 단일 Lottie 나비 컴포넌트. 다량 렌더(17마리+)를 전제로 `memo` 처리.
 * 각 인스턴스가 JSON 데이터를 deep clone 하여 Lottie 내부 mutation 영향 격리.
 */
function ButterflyImpl({ animationData, hue, speed }: ButterflyProps) {
  const clonedData = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (animationData ? (JSON.parse(JSON.stringify(animationData)) as any) : null),
    [animationData],
  )

  const { View, setSpeed } = useLottie(
    {
      animationData: clonedData,
      loop: true,
      autoplay: true,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    },
    {
      width: '100%',
      height: '100%',
      filter: `hue-rotate(${hue}deg) saturate(1.35) brightness(1.02)`,
    },
  )

  useEffect(() => {
    if (typeof setSpeed === 'function') setSpeed(speed)
  }, [speed, setSpeed])

  if (!clonedData) return null
  return View
}

export const Butterfly = memo(ButterflyImpl)
