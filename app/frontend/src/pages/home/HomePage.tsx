import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthModal, useAuthModal } from '../../features/auth'
import { ForestScene } from '../main'
import { ROUTES } from '../../shared/constants'
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
 * 3. 로그인 성공 → 모달 닫힘 + ForestScene 이 뒤에 사전 렌더 + 나비 떼 확산 + 원형 디졸브 exit
 *    - 마스크 리빌이 중심부터 투명해지면서 뒤의 ForestScene 이 자연스럽게 드러남
 *    - 원본 story-forest 가 view state 로 동일 컴포넌트 내 전환이던 효과를 라우트 기반에서 재현
 * 4. exit 애니메이션 타이밍(4.1s) 에 맞춰 `/main` 으로 라우트 전환 (URL 정리)
 *    - 이 시점 ForestScene 이미 화면에 있으므로 시각적 점프 최소화
 */
export function HomePage() {
  const [isExiting, setIsExiting] = useState(false)
  const butterflyAnim = useButterflyAnim()
  const particles = useMemo(() => generateSwarmParticles(), [])
  const auth = useAuthModal('login')
  const navigate = useNavigate()

  const handleStart = useCallback(() => {
    if (isExiting) return
    auth.open('login')
  }, [isExiting, auth])

  const handleAuthSuccess = useCallback(() => {
    auth.close()
    setIsExiting(true)
    // 원본 App.jsx 와 동일 타이밍 — exit 애니메이션(나비 확산 + 원형 디졸브 마스크) 완료 직전에 라우트 전환
    setTimeout(() => navigate(ROUTES.main, { replace: true }), 4100)
  }, [auth, navigate])

  return (
    <>
      {/* exit 동안 랜딩 뒤에 숲 씬 사전 렌더 → 마스크 리빌이 드러낼 "실제 화면".
          landing-screen 이 z-index 9999 로 위에 있어 클릭 이벤트 차단 + ForestScene 상호작용 자동 차단. */}
      {isExiting && <ForestScene />}

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
