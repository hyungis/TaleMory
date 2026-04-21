import { useCallback, useMemo, useState } from 'react'
import { AuthModal, useAuthModal } from '../../features/auth'
import { ButterflySwarm } from './ui/ButterflySwarm'
import { useButterflyAnim } from './model/useButterflyAnim'
import { generateSwarmParticles } from './lib/generateSwarmParticles'
import './styles/landing.css'

/**
 * TaleMory 랜딩 페이지.
 *
 * 플로우:
 * 1. 배경 영상 + TaleMory 타이틀 + "시작하기" 버튼
 * 2. 시작하기 클릭 → `AuthModal` open (login/register 탭)
 * 3. 로그인 성공 → 모달 닫힘 + 나비 떼 확산 + 원형 디졸브 exit 애니메이션
 * 4. TODO(S14P31S210-76): exit 완료 후 다음 뷰(숲+집 main scene) 로 전환 — 라우터/layout 은 step 6.
 */
export function HomePage() {
  const [isExiting, setIsExiting] = useState(false)
  const butterflyAnim = useButterflyAnim()
  const particles = useMemo(() => generateSwarmParticles(), [])
  const auth = useAuthModal('login')

  const handleStart = useCallback(() => {
    if (isExiting) return
    auth.open('login')
  }, [isExiting, auth])

  const handleAuthSuccess = useCallback(() => {
    auth.close()
    setIsExiting(true)
    // TODO(S14P31S210-76): setTimeout(() => navigate('/main'), 4100) — 라우터 도입 후.
  }, [auth])

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

      <AuthModal
        isOpen={auth.isOpen}
        mode={auth.mode}
        onClose={auth.close}
        onSwitchMode={auth.switchMode}
        onSuccess={handleAuthSuccess}
      />

      {isExiting && <ButterflySwarm animationData={butterflyAnim} particles={particles} />}
    </>
  )
}
