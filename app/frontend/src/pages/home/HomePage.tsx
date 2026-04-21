import { useCallback, useMemo, useState } from 'react'
import { ButterflySwarm } from './ui/ButterflySwarm'
import { useButterflyAnim } from './model/useButterflyAnim'
import { generateSwarmParticles } from './lib/generateSwarmParticles'
import './styles/landing.css'

/**
 * TaleMory 랜딩 페이지.
 *
 * - 배경 영상 + TaleMory 타이틀 + "시작하기" 버튼
 * - 버튼 클릭 시 나비 떼 확산 + 원형 디졸브 exit 애니메이션
 *
 * 현재 subtask(S14P31S210-75) 는 랜딩 UI 만 이관.
 * Auth 모달 연동은 다음 커밋(step 5) 에서 HomePage 내부로 주입.
 * 그때 `handleStart` 는 먼저 AuthModal 을 열고, 로그인 성공 콜백에서 `setIsExiting(true)` 를 호출하도록 변경.
 */
export function HomePage() {
  const [isExiting, setIsExiting] = useState(false)
  const butterflyAnim = useButterflyAnim()
  const particles = useMemo(() => generateSwarmParticles(), [])

  const handleStart = useCallback(() => {
    if (isExiting) return
    // TODO(S14P31S210-75, step 5): Auth 모달 열기 → 로그인 성공 시 setIsExiting(true)
    // 현재는 exit 애니메이션 단독 검증용으로 즉시 재생.
    setIsExiting(true)
  }, [isExiting])

  return (
    <>
      <div className={`landing-screen ${isExiting ? 'exiting' : ''}`}>
        <video
          className="landing-video"
          src="/randing_video.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className="landing-overlay">
          <div className="landing-text-block">
            <h1 className="landing-title">TaleMory</h1>
            <p className="landing-subtitle">가족의 추억으로 만드는 영어동화책</p>
          </div>
          <button
            type="button"
            className="landing-start-btn"
            onClick={handleStart}
            disabled={isExiting}
          >
            시작하기
          </button>
        </div>
      </div>

      {isExiting && <ButterflySwarm animationData={butterflyAnim} particles={particles} />}
    </>
  )
}
