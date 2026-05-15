import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthModal, getAuthSessionSnapshot, initializeAuthSession, useAuthModal } from '../../features/auth'
import { ROUTES } from '../../shared/constants'
import { FeedbackDialog } from '../../shared/ui'
import { generateSwarmParticles } from './lib/generateSwarmParticles'
import { useButterflyAnim } from './model/useButterflyAnim'
import './styles/landing.css'
import { ButterflySwarm } from './ui/ButterflySwarm'

interface HomeKakaoSignupDraft {
  signupToken: string
  profile: {
    email: string
    name: string
    nickname: string
    phone?: string | null
  }
}

interface HomeLocationState {
  kakaoSignupDraft?: HomeKakaoSignupDraft
  kakaoSignupNotice?: boolean
}

/**
 * 디졸브(나비 떼 + 원형 마스크) 가 어느 정도 진행된 뒤 `/main` 으로 navigate 한다.
 *
 * - CSS 마스크 자체 길이는 5.9s 지만, 너무 늦게 URL 동기화하면 마이페이지/로그아웃
 *   같은 다른 진입점이 / 에 잠깐 머무는 어색한 상태가 길어진다.
 * - 2500ms 쯤이면 나비 떼가 충분히 흩어지고 마스크도 어느 정도 열려, navigate 시
 *   HomePage 가 unmount 되어도 시각적으로 자연스럽게 ForestScene 으로 이어진다.
 * - 이 값을 더 짧게/길게 조정하면 나비 visual 노출 시간과 URL 동기화 타이밍이 같이 변한다.
 */
const LANDING_EXIT_DURATION_MS = 2500

/**
 * TaleMory 랜딩 페이지 — `/` 라우트의 오버레이.
 *
 * MainShell 이 / 와 /main/* 양쪽에서 같은 MainPage 인스턴스를 항상 렌더하므로,
 * HomePage 는 그 위로 얹는 "랜딩 영상 + 시작하기 + 디졸브" 오버레이만 담당한다.
 *
 * 흐름:
 * 1. 배경 영상 + 타이틀 + "시작하기" 버튼
 * 2. 시작하기 클릭 → 로그인 안 됐으면 `AuthModal`, 됐으면 곧장 디졸브 진입
 * 3. 인증 성공 → 나비 떼 흩어짐 + 원형 마스크 디졸브 (마스크 뒤엔 이미 MainShell 의 ForestScene)
 * 4. `LANDING_EXIT_DURATION_MS` 후 → `/main` 으로 navigate (URL 동기화)
 *
 * navigate 시 HomePage 가 unmount 되어 오버레이가 사라지지만 MainShell 의 MainPage 는 그대로
 * 유지되므로 ForestScene 의 particles / 애니메이션 / phase 가 끊기지 않는다.
 */
export function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const initialLocationState = location.state as HomeLocationState | null
  const initialKakaoSignupDraft = initialLocationState?.kakaoSignupDraft ?? null
  const shouldOpenKakaoSignup = initialKakaoSignupDraft !== null
  const [isExiting, setIsExiting] = useState(false)
  const [isLandingDone, setIsLandingDone] = useState(false)
  const [kakaoSignupDraft, setKakaoSignupDraft] = useState<HomeKakaoSignupDraft | null>(initialKakaoSignupDraft)
  const [isKakaoSignupNoticeOpen, setIsKakaoSignupNoticeOpen] = useState(
    shouldOpenKakaoSignup ? (initialLocationState?.kakaoSignupNotice ?? true) : false,
  )
  const butterflyAnim = useButterflyAnim()
  const particles = useMemo(() => generateSwarmParticles(), [])
  const {
    isOpen: isAuthOpen,
    mode: authMode,
    open: openAuth,
    close: closeAuth,
    switchMode: switchAuthMode,
  } = useAuthModal(shouldOpenKakaoSignup ? 'register' : 'login', shouldOpenKakaoSignup)

  const startLandingExit = useCallback(() => {
    closeAuth()
    setIsExiting(true)
  }, [closeAuth])

  useEffect(() => {
    if (!shouldOpenKakaoSignup) return
    navigate(ROUTES.home, { replace: true, state: null })
  }, [navigate, shouldOpenKakaoSignup])

  // 디졸브 시작 후 LANDING_EXIT_DURATION_MS 뒤에 landing DOM 제거 + URL 을 /main 으로 동기화.
  // useEffect 로 두어 HomePage 가 도중에 unmount 되면 cleanup 으로 timeout 자동 cancel.
  useEffect(() => {
    if (!isExiting || isLandingDone) return

    const timeoutId = window.setTimeout(() => {
      setIsLandingDone(true)
      navigate(ROUTES.main, { replace: true })
    }, LANDING_EXIT_DURATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [isExiting, isLandingDone, navigate])

  const handleStart = useCallback(async () => {
    if (isExiting) return

    // 부팅 시 silent refresh 가 아직 진행 중일 수 있어 한 번 await — 캐시된 promise 가 반환되므로
    // 이미 끝난 상태면 즉시 통과. refresh 실패 시 내부에서 clearAuthSession() 이 호출되어
    // 아래 snapshot.isAuthenticated 가 false 가 되고 자연스럽게 로그인 모달이 뜬다.
    await initializeAuthSession()

    // useAuthSession 훅의 isAuthenticated 는 useCallback 클로저로 스냅된 값이라 stale 가능 →
    // 항상 최신 snapshot 으로 다시 판단해야 stale 토큰 진입을 막을 수 있다.
    if (getAuthSessionSnapshot().isAuthenticated) {
      startLandingExit()
      return
    }
    openAuth('login')
  }, [isExiting, openAuth, startLandingExit])

  const handleAuthSuccess = useCallback(() => {
    startLandingExit()
  }, [startLandingExit])

  const handleKakaoSignupCancel = useCallback(() => {
    setKakaoSignupDraft(null)
    setIsKakaoSignupNoticeOpen(false)
  }, [])

  return (
    <>
      {/* MainPage 는 MainShell 레이아웃에서 항상 렌더 — landing-screen 의 mask 뒤에
          이미 ForestScene 이 있어 디졸브 진행 시 자연스럽게 reveal 된다. */}

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
            <Link to={ROUTES.about} className="landing-about-link">
              서비스 소개
            </Link>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={isAuthOpen}
        mode={authMode}
        onClose={closeAuth}
        onSwitchMode={switchAuthMode}
        onSuccess={handleAuthSuccess}
        kakaoSignupDraft={kakaoSignupDraft}
        onKakaoSignupCancel={handleKakaoSignupCancel}
      />

      {isKakaoSignupNoticeOpen && (
        <FeedbackDialog
          variant="info"
          title="회원 정보 입력이 필요해요"
          message="카카오 인증은 완료됐어요. 가입을 마치려면 서비스에서 사용할 회원 정보를 한 번 더 확인해주세요."
          onClose={() => setIsKakaoSignupNoticeOpen(false)}
        />
      )}

      {isExiting && !isLandingDone && (
        <ButterflySwarm animationData={butterflyAnim} particles={particles} />
      )}
    </>
  )
}
