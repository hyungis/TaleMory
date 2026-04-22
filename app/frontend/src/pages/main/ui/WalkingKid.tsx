import { useEffect, useMemo, type Ref } from 'react'
import { useLottie } from 'lottie-react'

interface KidLottieProps {
  animationData: unknown
  walking: boolean
}

/**
 * Lottie 옆걸음 아이. walking=true 면 재생, false 면 첫 프레임(idle)로 정지.
 * animationData 는 `useKidAnim` 에서 fetch 한 JSON (한 번만 로드 후 재사용).
 */
function KidLottie({ animationData, walking }: KidLottieProps) {
  const clonedData = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (animationData ? (JSON.parse(JSON.stringify(animationData)) as any) : null),
    [animationData],
  )

  const { View, play, goToAndStop } = useLottie(
    {
      animationData: clonedData,
      loop: true,
      autoplay: false,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    },
    { width: '100%', height: '100%' },
  )

  useEffect(() => {
    if (!clonedData) return
    if (walking) {
      play?.()
    } else {
      goToAndStop?.(0, true)
    }
  }, [walking, clonedData, play, goToAndStop])

  if (!clonedData) return null
  return View
}

interface WalkingKidProps {
  animationData: unknown
  walking: boolean
  /** 문 앞 도착 후 Lottie 대신 뒷모습 PNG(`/boy.png`) 를 보여줄지 여부. */
  showBackView: boolean
  /**
   * kid-character 컨테이너 div 에 대한 ref.
   * `useHouseWalk` 훅이 RAF 에서 inline transform 을 직접 조작하기 위해 필요.
   *
   * React 19 의 ref-as-prop 패턴을 사용 (forwardRef 불필요).
   */
  ref?: Ref<HTMLDivElement>
}

/**
 * 숲 씬 하단에 등장하는 아이 캐릭터.
 * - 평소: Lottie 옆걸음(idle 프레임)
 * - 집 클릭 후: Lottie 재생 (walking=true) 으로 옆걸음
 * - 문 앞 도착: showBackView=true → boy.png 뒷모습으로 스왑 (Lottie 제거)
 */
export function WalkingKid({ animationData, walking, showBackView, ref }: WalkingKidProps) {
  // Lottie 도 로드 안 되고 back-view 도 아니면 렌더 스킵 (초기 로딩 상태)
  if (!animationData && !showBackView) return null

  return (
    <div ref={ref} className={`kid-character ${walking ? 'walking' : ''}`}>
      {showBackView ? (
        <img src="/boy.png" alt="뒷모습" className="kid-back-view" draggable={false} />
      ) : animationData ? (
        <KidLottie animationData={animationData} walking={walking} />
      ) : null}
    </div>
  )
}
