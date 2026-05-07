import { useCallback, type ReactNode } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import type { AuthMode } from '../model/useAuthModal'
import { LoginForm, type LoginResponse } from '../login'
import { setAuthSession } from '../model/authSession'
import { SignupForm } from '../signup'

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
  tabs?: ReactNode
  children: ReactNode
  onClose: () => void
}

function AuthIcon({ mode }: { mode: AuthMode }) {
  return mode === 'login' ? (
    <LogIn className="w-5 h-5" style={{ color: '#5b3a18' }} />
  ) : (
    <UserPlus className="w-5 h-5" style={{ color: '#5b3a18' }} />
  )
}

function AuthModalFrame({
  title,
  subtitle,
  icon = 'register',
  tabs,
  children,
  onClose,
}: AuthModalFrameProps) {
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(74, 59, 42, 0.55)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md relative overflow-visible"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, #fbf2da 0%, #f5e6bd 100%)',
          border: '2.5px solid #a37548',
          borderRadius: 24,
          boxShadow: '0 4px 0 #a37548, 0 16px 40px rgba(140, 100, 60, 0.35)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -16,
            left: 32,
            width: 90,
            height: 26,
            background: 'rgba(255, 230, 140, 0.7)',
            border: '1px dashed rgba(150, 110, 50, 0.35)',
            transform: 'rotate(-5deg)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -12,
            right: 38,
            width: 74,
            height: 22,
            background: 'rgba(216, 165, 124, 0.5)',
            border: '1px dashed rgba(150, 110, 50, 0.35)',
            transform: 'rotate(7deg)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          }}
        />

        <div className="flex items-center justify-between" style={{ padding: '22px 24px 16px' }}>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: '#f0c97a',
                border: '2px solid #a37548',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 0 #a37548',
              }}
            >
              <AuthIcon mode={icon} />
            </div>
            <div>
              {subtitle && (
                <p
                  style={{
                    margin: '0 0 2px',
                    fontFamily: 'var(--font-display)',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#8a7558',
                  }}
                >
                  {subtitle}
                </p>
              )}
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  fontWeight: 700,
                  color: '#5f7d50',
                  margin: 0,
                  letterSpacing: '0.02em',
                  WebkitTextStroke: '0.4px #5f7d50',
                }}
              >
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#fcf3df',
              border: '2px solid #a37548',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 0 rgba(74,59,42,0.2)',
              transition: 'transform 0.2s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3,3 L13,13 M13,3 L3,13" stroke="#a37548" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {tabs ?? <div style={{ borderBottom: '2px dashed rgba(163, 117, 72, 0.35)', margin: '0 8px' }} />}

        <div className="overflow-y-auto" style={{ maxHeight: '65vh' }}>
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

  const tabs = (
    <div className="flex" style={{ borderBottom: '2px dashed rgba(163, 117, 72, 0.35)', margin: '0 8px' }}>
      {(['login', 'register'] as const).map(tab => (
        <button
          key={tab}
          type="button"
          onClick={() => handleSwitchMode(tab)}
          style={{
            flex: 1,
            padding: '10px 0',
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: mode === tab ? '#5f7d50' : '#8a7558',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'color 0.2s',
          }}
        >
          {tab === 'login' ? '로그인' : '회원가입'}
          {mode === tab && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '20%',
                right: '20%',
                bottom: -2,
                height: 3,
                background: '#7a9968',
                borderRadius: 2,
              }}
            />
          )}
        </button>
      ))}
    </div>
  )

  return (
    <AuthModalFrame
      title={mode === 'login' ? '로그인' : '회원가입'}
      subtitle={isKakaoSignupMode ? '카카오 인증 완료' : undefined}
      icon={mode}
      tabs={tabs}
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
