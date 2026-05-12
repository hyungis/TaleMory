import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { MousePointerClick, Sparkles, X } from 'lucide-react'
import { useAuthSession } from '../../auth'
import { ROUTES } from '../../../shared/constants'
import { ONBOARDING_STEPS } from '../model/onboardingSteps'
import {
  hasSeenOnboardingPromptThisSession,
  markOnboardingPromptSeenThisSession,
  readOnboardingStatus,
  writeOnboardingStatus,
} from '../model/onboardingStorage'

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

interface ViewportSize {
  width: number
  height: number
}

function isEligiblePath(pathname: string): boolean {
  return pathname !== ROUTES.home && !pathname.startsWith('/auth/')
}

export function OnboardingTutorialProvider({ children }: PropsWithChildren) {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuthSession()

  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const [isTutorialActive, setIsTutorialActive] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 })

  const activeStep = ONBOARDING_STEPS[activeIndex] ?? null

  useEffect(() => {
    if (!auth.isAuthenticated || auth.user === null) {
      setIsPromptOpen(false)
      setIsTutorialActive(false)
      return
    }

    if (isPromptOpen || isTutorialActive) return
    if (readOnboardingStatus(auth.user) !== null) return
    if (hasSeenOnboardingPromptThisSession(auth.user)) return
    if (!isEligiblePath(location.pathname)) return

    markOnboardingPromptSeenThisSession(auth.user)
    setIsPromptOpen(true)
  }, [auth.isAuthenticated, auth.user, isPromptOpen, isTutorialActive, location.pathname])

  useEffect(() => {
    if (!isTutorialActive || activeStep === null) return
    if (location.pathname === activeStep.route) return
    navigate(activeStep.route)
  }, [activeStep, isTutorialActive, location.pathname, navigate])

  const closeTutorialForSession = useCallback(() => {
    setIsPromptOpen(false)
    setIsTutorialActive(false)
    setActiveIndex(0)
    setTargetRect(null)
  }, [])

  const completeTutorial = useCallback(() => {
    writeOnboardingStatus(auth.user, 'completed')
    closeTutorialForSession()
  }, [auth.user, closeTutorialForSession])

  const startTutorial = useCallback(() => {
    setIsPromptOpen(false)
    setIsTutorialActive(true)
    setActiveIndex(0)
    if (location.pathname !== ROUTES.main) {
      navigate(ROUTES.main)
    }
  }, [location.pathname, navigate])

  const advanceTutorial = useCallback(() => {
    const next = activeIndex + 1
    if (next >= ONBOARDING_STEPS.length) {
      completeTutorial()
      return
    }
    setActiveIndex(next)
  }, [activeIndex, completeTutorial])

  const updateTargetRect = useCallback(() => {
    if (!isTutorialActive || activeStep === null || location.pathname !== activeStep.route) {
      setTargetRect(null)
      return
    }

    const target = document.querySelector<HTMLElement>(activeStep.selector)
    if (!target) {
      setTargetRect(null)
      return
    }

    const rect = target.getBoundingClientRect()
    const padding = 8
    setTargetRect({
      top: Math.max(8, rect.top - padding),
      left: Math.max(8, rect.left - padding),
      width: Math.min(window.innerWidth - 16, rect.width + padding * 2),
      height: Math.min(window.innerHeight - 16, rect.height + padding * 2),
    })
    setViewport({ width: window.innerWidth, height: window.innerHeight })
  }, [activeStep, isTutorialActive, location.pathname])

  useEffect(() => {
    if (!isTutorialActive || activeStep === null) return

    updateTargetRect()
    const rafId = window.requestAnimationFrame(updateTargetRect)
    const intervalId = window.setInterval(updateTargetRect, 400)
    const observer = new MutationObserver(updateTargetRect)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    window.addEventListener('resize', updateTargetRect)
    window.addEventListener('scroll', updateTargetRect, true)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearInterval(intervalId)
      observer.disconnect()
      window.removeEventListener('resize', updateTargetRect)
      window.removeEventListener('scroll', updateTargetRect, true)
    }
  }, [activeStep, isTutorialActive, updateTargetRect])

  useEffect(() => {
    if (!isTutorialActive || activeStep === null) return

    const handleTargetClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-onboarding-action]')) return
      if (!target.closest(activeStep.selector)) return

      window.setTimeout(advanceTutorial, 120)
    }

    document.addEventListener('click', handleTargetClick, true)
    return () => document.removeEventListener('click', handleTargetClick, true)
  }, [activeStep, advanceTutorial, isTutorialActive])

  const panelStyle = useMemo(() => {
    if (targetRect === null || viewport.width === 0 || viewport.height === 0) return null

    const width = Math.min(360, Math.max(280, viewport.width - 32))
    const left = Math.min(
      Math.max(16, targetRect.left),
      Math.max(16, viewport.width - width - 16),
    )
    const belowTop = targetRect.top + targetRect.height + 14
    const aboveTop = targetRect.top - 176
    const top = belowTop + 156 <= viewport.height ? belowTop : Math.max(16, aboveTop)

    return { width, left, top }
  }, [targetRect, viewport])

  return (
    <>
      {children}
      {isPromptOpen && (
        <OnboardingPrompt
          onStart={startTutorial}
          onDismiss={closeTutorialForSession}
        />
      )}
      {isTutorialActive && activeStep && targetRect && panelStyle && (
        <OnboardingSpotlight
          rect={targetRect}
          panelStyle={panelStyle}
          stepNumber={activeIndex + 1}
          totalSteps={ONBOARDING_STEPS.length}
          title={activeStep.title}
          description={activeStep.description}
          onSkip={closeTutorialForSession}
        />
      )}
    </>
  )
}

function OnboardingPrompt({
  onStart,
  onDismiss,
}: {
  onStart: () => void
  onDismiss: () => void
}) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-prompt-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'rgba(34, 26, 18, 0.5)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff9e8',
          border: '2px solid #9a7548',
          borderRadius: 8,
          boxShadow: '0 18px 44px rgba(40, 28, 18, 0.32), 0 4px 0 #9a7548',
          padding: '24px 26px',
          color: '#33251a',
          fontFamily: 'var(--font-display), system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              background: '#2d5a27',
              color: '#fff9e8',
            }}
          >
            <Sparkles className="w-5 h-5" />
          </span>
          <div>
            <h2
              id="onboarding-prompt-title"
              style={{
                margin: '0 0 8px',
                fontFamily: 'var(--font-display), system-ui, sans-serif',
                fontSize: 25,
                fontWeight: 800,
                lineHeight: 1.25,
              }}
            >
              처음이시네요. 튜토리얼을 진행할까요?
            </h2>
            <p style={{ margin: 0, color: '#5f4b34', fontSize: 17, lineHeight: 1.5 }}>
              메인 화면, 동화책 목록, 동화책 만들기까지 핵심 버튼을 차례대로 눌러볼 수 있게 안내해드릴게요.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              border: '2px solid #9a7548',
              background: '#e9dbbe',
              color: '#3e2a18',
              borderRadius: 999,
              padding: '10px 18px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            아니요
          </button>
          <button
            type="button"
            onClick={onStart}
            style={{
              border: '2px solid #2d5a27',
              background: '#2d5a27',
              color: '#fff9e8',
              borderRadius: 999,
              padding: '10px 20px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 3px 0 #1a3a14',
            }}
          >
            예, 진행할게요
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function OnboardingSpotlight({
  rect,
  panelStyle,
  stepNumber,
  totalSteps,
  title,
  description,
  onSkip,
}: {
  rect: TargetRect
  panelStyle: { width: number; left: number; top: number }
  stepNumber: number
  totalSteps: number
  title: string
  description: string
  onSkip: () => void
}) {
  return createPortal(
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 8800,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'fixed',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: 18,
            boxShadow:
              '0 0 0 9999px rgba(34, 26, 18, 0.56), 0 0 0 3px #f6d66d, 0 16px 36px rgba(31, 24, 16, 0.3)',
            outline: '2px solid rgba(255,255,255,0.9)',
          }}
        />
      </div>

      <aside
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          zIndex: 8810,
          top: panelStyle.top,
          left: panelStyle.left,
          width: panelStyle.width,
          background: '#fff9e8',
          border: '2px solid #9a7548',
          borderRadius: 8,
          boxShadow: '0 14px 32px rgba(40, 28, 18, 0.28), 0 3px 0 #9a7548',
          padding: '14px 16px',
          color: '#33251a',
          fontFamily: 'var(--font-display), system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              background: '#2d5a27',
              color: '#fff9e8',
            }}
          >
            <MousePointerClick className="w-4 h-4" />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#8a6a18', marginBottom: 3 }}>
              {stepNumber} / {totalSteps}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, marginBottom: 5 }}>
              {title}
            </div>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45, fontWeight: 700, color: '#5f4b34' }}>
              {description}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 800, color: '#2d5a27' }}>
              포커스된 영역을 눌러보세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="튜토리얼 건너뛰기"
            data-onboarding-action
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: '1px solid rgba(95, 75, 52, 0.35)',
              background: '#fff3cf',
              color: '#5f4b34',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>,
    document.body,
  )
}
