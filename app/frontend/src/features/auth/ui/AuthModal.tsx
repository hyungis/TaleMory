import { useCallback, type ReactNode } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import type { AuthMode } from '../model/useAuthModal'
import { LoginForm, type LoginResponse } from '../login'
import { setAuthSession } from '../model/authSession'
import { SignupForm } from '../signup'
import './AuthModal.css'

interface AuthKakaoSignupDraft {
  signupToken: string
  profile: {
    email: string
    name: string
    nickname: string
    phone?: string | null
  }
}

interface AuthModalProps {
  isOpen: boolean
  mode: AuthMode
  onClose: () => void
  onSwitchMode: (mode: AuthMode) => void
  onSuccess: () => void
  kakaoSignupDraft?: AuthKakaoSignupDraft | null
  onKakaoSignupCancel?: () => void
}

interface AuthModalFrameProps {
  title: string
  subtitle?: string
  icon?: AuthMode
  children: ReactNode
  onClose: () => void
}

function AuthIcon({ mode }: { mode: AuthMode }) {
  return mode === 'login' ? (
    <LogIn className="auth-modal__icon-svg" />
  ) : (
    <UserPlus className="auth-modal__icon-svg" />
  )
}

function AuthModalFrame({
  title,
  subtitle,
  icon = 'register',
  children,
  onClose,
}: AuthModalFrameProps) {
  return (
    <div className="auth-modal">
      <div
        className="auth-modal__panel"
        onClick={e => e.stopPropagation()}
      >
        <span className="auth-modal__tape auth-modal__tape--left" aria-hidden="true" />
        <span className="auth-modal__tape auth-modal__tape--right" aria-hidden="true" />

        <div className="auth-modal__header">
          <div className="auth-modal__title-row">
            <div className="auth-modal__icon">
              <AuthIcon mode={icon} />
            </div>
            <div>
              {subtitle && (
                <p className="auth-modal__subtitle">{subtitle}</p>
              )}
              <h3 className="auth-modal__title">{title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="auth-modal__close"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path className="auth-modal__close-path" d="M3,3 L13,13 M13,3 L3,13" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="auth-modal__divider" />

        <div className="auth-modal__body">
          {children}
        </div>
      </div>
    </div>
  )
}

export function AuthModal({
  isOpen,
  mode,
  onClose,
  onSwitchMode,
  onSuccess,
  kakaoSignupDraft,
  onKakaoSignupCancel,
}: AuthModalProps) {
  const handleSignedUp = useCallback(() => {
    onSwitchMode('login')
  }, [onSwitchMode])

  const handleClose = useCallback(() => {
    onKakaoSignupCancel?.()
    onClose()
  }, [onClose, onKakaoSignupCancel])

  const handleSwitchMode = useCallback(
    (nextMode: AuthMode) => {
      if (nextMode !== 'register') {
        onKakaoSignupCancel?.()
      }
      onSwitchMode(nextMode)
    },
    [onKakaoSignupCancel, onSwitchMode],
  )

  const handleKakaoSignupCancel = useCallback(() => {
    onKakaoSignupCancel?.()
    onClose()
  }, [onClose, onKakaoSignupCancel])

  const handleKakaoSignedUp = useCallback(
    (result: LoginResponse) => {
      setAuthSession(result)
      onKakaoSignupCancel?.()
      onSuccess()
    },
    [onKakaoSignupCancel, onSuccess],
  )

  if (!isOpen) return null

  const isKakaoSignupMode = mode === 'register' && kakaoSignupDraft !== null && kakaoSignupDraft !== undefined

  return (
    <AuthModalFrame
      title={mode === 'login' ? '로그인' : '회원가입'}
      subtitle={isKakaoSignupMode ? '카카오 인증 완료' : undefined}
      icon={mode}
      onClose={handleClose}
    >
      {mode === 'login' ? (
        <LoginForm onSuccess={onSuccess} onSwitchToRegister={() => handleSwitchMode('register')} />
      ) : (
        <SignupForm
          key={isKakaoSignupMode ? `kakao-${kakaoSignupDraft.signupToken}` : 'standard-signup'}
          onSignedUp={handleSignedUp}
          onSwitchToLogin={() => handleSwitchMode('login')}
          kakaoSignup={kakaoSignupDraft}
          onKakaoSignedUp={handleKakaoSignedUp}
          onKakaoSignupCancel={handleKakaoSignupCancel}
        />
      )}
    </AuthModalFrame>
  )
}
