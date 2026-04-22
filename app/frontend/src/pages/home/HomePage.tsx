import { useCallback, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AuthModal, useAuthModal, useAuthSession } from '../../features/auth'
import { MainPage } from '../main'
import { generateSwarmParticles } from './lib/generateSwarmParticles'
import { useButterflyAnim } from './model/useButterflyAnim'
import './styles/landing.css'
import { ButterflySwarm } from './ui/ButterflySwarm'

/** 랜딩 exit 애니메이션 총 길이 (mask 5.5s + 0.4s delay ≒ 5.9s) 에 약간의 버퍼 */
const LANDING_EXIT_DURATION_MS = 6000

/**
 * TaleMory 랜딩 페이지.
 *
 * 플로우:
 * 1. 배경 영상 + TaleMory 타이틀 + "시작하기" 버튼
 * 2. 시작하기 클릭 → `AuthModal` open (login/register 탭)
 * 3. 로그인 성공 → MainPage 를 in-place 렌더(landing 뒤) + 나비 떼 확산 + 원형 디졸브 마스크
 *    - 마스크가 중심부터 투명화되며 뒤의 MainPage(ForestScene) 가 드러남
 *    - 애니메이션 종료 후 landing DOM 만 제거 → MainPage 상호작용 시작
 *
 * 왜 navigate('/main') 안 쓰는가:
 * - 라우트 전환 시 HomePage 언마운트 → MainPage 마운트 과정에서 ForestScene 이 재마운트되며
 *   Lottie/파티클/CSS 애니메이션이 리셋 → 시각적 stutter 발생
 * - MainPage 를 내부에서 렌더하면 한 번 마운트된 상태 그대로 유지
 * - URL 은 / 에 유지되지만 씬(forest ↔ bookstore) 내부 전환은 정상 동작 (useSceneTransition 은 window.history 직접 조작)
 * - /main 직접 URL 진입 시에도 동일 MainPage 가 렌더되므로 북마크/새로고침 호환
 */
export function HomePage() {
  const location = useLocation()
  /**
   * 제작 플로우 완료/이탈에서 `navigate('/', { state: { skipLanding: true } })` 로
   * 돌아오면 이미 인증된 유저이므로 랜딩 영상·나비 떼·디졸브 마스크를 전부 생략하고
   * 바로 MainPage(책장 씬)를 보여준다.
   */
  const skipLanding = (location.state as { skipLanding?: boolean } | null)?.skipLanding === true
  const [isExiting, setIsExiting] = useState(skipLanding)
  const [isLandingDone, setIsLandingDone] = useState(skipLanding)
  const butterflyAnim = useButterflyAnim()
  const particles = useMemo(() => generateSwarmParticles(), [])
  const auth = useAuthModal('login')
  const { isAuthenticated } = useAuthSession()

  const startLandingExit = useCallback(() => {
    auth.close()
    setIsExiting(true)
    setTimeout(() => setIsLandingDone(true), LANDING_EXIT_DURATION_MS)
  }, [auth])

  const handleStart = useCallback(() => {
    if (isExiting) return

    // 이미 로그인된 사용자는 모달을 다시 열지 않고 바로 랜딩 연출만 종료한다.
    if (isAuthenticated) {
      startLandingExit()
      return
    }

    auth.open('login')
  }, [auth, isAuthenticated, isExiting, startLandingExit])

  const handleAuthSuccess = useCallback(() => {
    // 랜딩 exit 애니메이션 완료 뒤 landing DOM 제거.
    // 안 하면 position:fixed + z-index:9999 로 MainPage 의 모든 포인터 이벤트 차단.
    startLandingExit()
  }, [startLandingExit])

  return (
    <>
      {/* 로그인 이후 MainPage in-place 렌더 — 재마운트 없이 landing 마스크 뒤에 유지 */}
      {isExiting && <MainPage />}

      {!isLandingDone && (
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
              <p className="landing-subtitle">가족의 추억으로 만드는 영어 동화책</p>
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
      )}

      <AuthModal
        isOpen={auth.isOpen}
        mode={auth.mode}
        onClose={auth.close}
        onSwitchMode={auth.switchMode}
        onSuccess={handleAuthSuccess}
      />

      {isExiting && !isLandingDone && (
        <ButterflySwarm animationData={butterflyAnim} particles={particles} />
      )}
    </>
  )
}
