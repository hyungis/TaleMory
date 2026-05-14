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
import { setAuthSession, useAuthSession } from '../../auth'
import { ROUTES } from '../../../shared/constants'
import { completeOnboarding } from '../api/completeOnboarding'
import { ONBOARDING_STEPS, type OnboardingStep } from '../model/onboardingSteps'
import {
  hasSeenOnboardingPromptThisSession,
  markOnboardingPromptSeenThisSession,
} from '../model/onboardingStorage'
import { OnboardingTutorialContext } from '../model/onboardingTutorialContext'

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

interface PanelStyle {
  width: number
  left: number
  top: number
  maxHeight: number
}

const PANEL_MARGIN = 16
const PANEL_GAP = 14
const PANEL_MIN_WIDTH = 280
const PANEL_MAX_WIDTH = 360
const PANEL_ESTIMATED_HEIGHT = 248

function isEligiblePath(pathname: string): boolean {
  return pathname !== '/auth' && !pathname.startsWith('/auth/')
}

function isStepRoute(pathname: string, step: OnboardingStep): boolean {
  const routeParts = step.route.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)

  if (routeParts.length !== pathParts.length) return false

  return routeParts.every((part, index) => part.startsWith(':') || part === pathParts[index])
}

function getCreationPreviewStep(locationState: unknown): number | null {
  if (typeof locationState !== 'object' || locationState === null) return null
  if (!('onboardingPreviewStep' in locationState)) return null

  const value = (locationState as { onboardingPreviewStep?: unknown }).onboardingPreviewStep
  return typeof value === 'number' ? value : null
}

type ViewerPreviewMode = NonNullable<OnboardingStep['viewerPreviewMode']>

function getViewerPreviewMode(locationState: unknown): ViewerPreviewMode | null {
  if (typeof locationState !== 'object' || locationState === null) return null
  if (!('onboardingViewerMode' in locationState)) return null

  const value = (locationState as { onboardingViewerMode?: unknown }).onboardingViewerMode
  return value === 'main' || value === 'book' || value === 'tools' ? value : null
}

export function OnboardingTutorialProvider({ children }: PropsWithChildren) {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuthSession()

  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false)
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
    if (auth.user.onboardingCompleted === true) return
    if (hasSeenOnboardingPromptThisSession(auth.user)) return
    if (!isEligiblePath(location.pathname)) return

    setIsPromptOpen(true)
  }, [auth.isAuthenticated, auth.user, isPromptOpen, isTutorialActive, location.pathname])

  useEffect(() => {
    if (!isTutorialActive || activeStep === null) return
    const previewStep = getCreationPreviewStep(location.state)
    const viewerPreviewMode = getViewerPreviewMode(location.state)
    const needsPreviewState =
      activeStep.route === ROUTES.creation &&
      activeStep.previewStep !== undefined &&
      previewStep !== activeStep.previewStep
    const needsViewerState =
      activeStep.viewerPreviewMode !== undefined &&
      viewerPreviewMode !== activeStep.viewerPreviewMode

    if (isStepRoute(location.pathname, activeStep) && !needsPreviewState && !needsViewerState) return

    const navigationOptions =
      activeStep.route === ROUTES.creation
        ? { replace: true, state: { onboardingPreview: true, onboardingPreviewStep: activeStep.previewStep } }
        : activeStep.viewerPreviewMode !== undefined
          ? { replace: true, state: { onboardingViewerMode: activeStep.viewerPreviewMode } }
          : undefined

    navigate(
      activeStep.route,
      navigationOptions,
    )
  }, [activeStep, isTutorialActive, location.pathname, location.state, navigate])

  const closeTutorialForSession = useCallback(() => {
    setIsPromptOpen(false)
    setIsExitConfirmOpen(false)
    setIsTutorialActive(false)
    setActiveIndex(0)
    setTargetRect(null)
  }, [])

  const markPromptHandled = useCallback(() => {
    if (auth.user === null) return
    markOnboardingPromptSeenThisSession(auth.user)
  }, [auth.user])

  const saveOnboardingCompletion = useCallback(() => {
    const user = auth.user
    const accessToken = auth.accessToken
    if (user === null) return

    void completeOnboarding()
      .then(() => {
        if (accessToken === null) return
        setAuthSession({
          accessToken,
          user: {
            ...user,
            onboardingCompleted: true,
          },
        })
      })
      .catch(() => {
        /* Onboarding is optional; a failed completion sync should not block navigation. */
      })
  }, [auth.accessToken, auth.user])

  const closeTutorialPrompt = useCallback(() => {
    markPromptHandled()
    saveOnboardingCompletion()
    closeTutorialForSession()
  }, [closeTutorialForSession, markPromptHandled, saveOnboardingCompletion])

  const completeTutorial = useCallback(() => {
    markPromptHandled()
    saveOnboardingCompletion()
    closeTutorialForSession()
    navigate(ROUTES.mainBookshelf, { replace: true })
  }, [closeTutorialForSession, markPromptHandled, navigate, saveOnboardingCompletion])

  const startTutorial = useCallback(() => {
    markPromptHandled()
    setIsPromptOpen(false)
    setIsExitConfirmOpen(false)
    setIsTutorialActive(true)
    setActiveIndex(0)
    setTargetRect(null)
    if (location.pathname !== ROUTES.main) {
      navigate(ROUTES.main)
    }
  }, [location.pathname, markPromptHandled, navigate])

  const openTutorialPrompt = useCallback(() => {
    setIsExitConfirmOpen(false)
    setIsPromptOpen(true)
  }, [])

  const requestExitTutorial = useCallback(() => {
    setIsExitConfirmOpen(true)
  }, [])

  const cancelExitTutorial = useCallback(() => {
    setIsExitConfirmOpen(false)
  }, [])

  const exitTutorialToMain = useCallback(() => {
    markPromptHandled()
    closeTutorialForSession()
    if (location.pathname !== ROUTES.main) {
      navigate(ROUTES.main, { replace: true })
    }
  }, [closeTutorialForSession, location.pathname, markPromptHandled, navigate])

  const advanceTutorial = useCallback(() => {
    const next = activeIndex + 1
    if (next >= ONBOARDING_STEPS.length) {
      completeTutorial()
      return
    }
    setActiveIndex(next)
  }, [activeIndex, completeTutorial])

  const updateTargetRect = useCallback(() => {
    if (!isTutorialActive || activeStep === null || !isStepRoute(location.pathname, activeStep)) {
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

  const panelStyle = useMemo(() => {
    if (targetRect === null || viewport.width === 0 || viewport.height === 0) return null

    const width = Math.min(
      PANEL_MAX_WIDTH,
      Math.max(PANEL_MIN_WIDTH, viewport.width - PANEL_MARGIN * 2),
    )
    const maxLeft = Math.max(PANEL_MARGIN, viewport.width - width - PANEL_MARGIN)
    const left = Math.min(Math.max(PANEL_MARGIN, targetRect.left), maxLeft)

    const panelHeight = Math.min(PANEL_ESTIMATED_HEIGHT, viewport.height - PANEL_MARGIN * 2)
    const maxTop = Math.max(PANEL_MARGIN, viewport.height - panelHeight - PANEL_MARGIN)
    const belowTop = targetRect.top + targetRect.height + PANEL_GAP
    const aboveTop = targetRect.top - panelHeight - PANEL_GAP
    const hasRoomBelow = belowTop + panelHeight <= viewport.height - PANEL_MARGIN
    const hasRoomAbove = aboveTop >= PANEL_MARGIN
    const preferredTop = hasRoomBelow
      ? belowTop
      : hasRoomAbove
        ? aboveTop
        : belowTop
    const top = Math.min(Math.max(PANEL_MARGIN, preferredTop), maxTop)
    const maxHeight = Math.max(180, viewport.height - top - PANEL_MARGIN)

    return { width, left, top, maxHeight }
  }, [targetRect, viewport])

  const contextValue = useMemo(
    () => ({ openTutorialPrompt, isTutorialActive }),
    [isTutorialActive, openTutorialPrompt],
  )

  return (
    <OnboardingTutorialContext.Provider value={contextValue}>
      {children}
      {isPromptOpen && (
        <OnboardingPrompt
          onStart={startTutorial}
          onDismiss={closeTutorialPrompt}
        />
      )}
      {isExitConfirmOpen && (
        <OnboardingExitConfirm
          onCancel={cancelExitTutorial}
          onConfirm={exitTutorialToMain}
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
          isLastStep={activeIndex === ONBOARDING_STEPS.length - 1}
          onNext={advanceTutorial}
          onSkip={requestExitTutorial}
        />
      )}
    </OnboardingTutorialContext.Provider>
  )
}

function OnboardingPrompt({
  onStart,
  onDismiss,
}: {
  onStart: () => void
  onDismiss: () => void
}) {
  const title = '튜토리얼을 진행할까요?'
  const description = '주요 화면과 기능을 처음부터 다시 안내해드리겠습니다.'

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
          boxSizing: 'border-box',
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
              {title}
            </h2>
            <p style={{ margin: 0, color: '#5f4b34', fontSize: 17, lineHeight: 1.5 }}>
              {description}
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
            닫기
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
            네, 진행할게요
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function OnboardingExitConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-exit-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9100,
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
          maxWidth: 380,
          boxSizing: 'border-box',
          background: '#fff9e8',
          border: '2px solid #9a7548',
          borderRadius: 8,
          boxShadow: '0 18px 44px rgba(40, 28, 18, 0.32), 0 4px 0 #9a7548',
          padding: '22px 24px',
          color: '#33251a',
          fontFamily: 'var(--font-display), system-ui, sans-serif',
        }}
      >
        <h2
          id="onboarding-exit-title"
          style={{
            margin: '0 0 10px',
            fontSize: 23,
            fontWeight: 800,
            lineHeight: 1.25,
          }}
        >
          튜토리얼을 나가시겠습니까?
        </h2>
        <p style={{ margin: 0, color: '#5f4b34', fontSize: 16, lineHeight: 1.5, fontWeight: 700 }}>
          지금 나가면 현재 튜토리얼 진행은 중단됩니다. 나중에 햄버거 메뉴에서 다시 볼 수 있습니다.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button
            type="button"
            onClick={onCancel}
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
            계속 보기
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              border: '2px solid #2d5a27',
              background: '#2d5a27',
              color: '#fff9e8',
              borderRadius: 999,
              padding: '10px 18px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 3px 0 #1a3a14',
            }}
          >
            나가기
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
  isLastStep,
  onNext,
  onSkip,
}: {
  rect: TargetRect
  panelStyle: PanelStyle
  stepNumber: number
  totalSteps: number
  title: string
  description: string
  isLastStep: boolean
  onNext: () => void
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
          pointerEvents: 'auto',
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
          maxHeight: panelStyle.maxHeight,
          overflowY: 'auto',
          boxSizing: 'border-box',
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
              확인했다면 다음으로 넘겨보세요.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                type="button"
                onClick={onNext}
                data-onboarding-action
                style={{
                  border: '2px solid #2d5a27',
                  background: '#2d5a27',
                  color: '#fff9e8',
                  borderRadius: 999,
                  padding: '8px 16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 0 #1a3a14',
                }}
              >
                {isLastStep ? '마치기' : '다음'}
              </button>
            </div>
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
