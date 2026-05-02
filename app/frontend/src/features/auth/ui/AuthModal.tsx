import { useCallback } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import type { AuthMode } from '../model/useAuthModal'
import { LoginForm } from '../login'
import { SignupForm } from '../signup'
import '../styles/auth.css'

interface AuthModalProps {
  isOpen: boolean
  mode: AuthMode
  onClose: () => void
  onSwitchMode: (mode: AuthMode) => void
  /** 로그인 성공 콜백. 상위에서 모달 닫기 + 랜딩 exit 애니메이션 등 후속 전환 수행. */
  onSuccess: () => void
}

/**
 * 로그인/회원가입 통합 모달 — paper-craft 톤.
 * 책장과 동일한 cream + caramel + sage 팔레트 + 손글씨 폰트로 디자인 통일.
 * 스타일은 `auth.css` 의 `auth-*` 클래스 사용.
 */
export function AuthModal({ isOpen, mode, onClose, onSwitchMode, onSuccess }: AuthModalProps) {
  const handleSignedUp = useCallback(() => {
    onSwitchMode('login')
  }, [onSwitchMode])

  if (!isOpen) return null

  return (
    <div className="auth-modal-back" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        {/* 워시 테이프 데코 */}
        <span className="auth-tape auth-tape--left" aria-hidden="true" />
        <span className="auth-tape auth-tape--right" aria-hidden="true" />

        {/* Header */}
        <div className="auth-header">
          <div className="auth-header-title">
            <div className="auth-header-icon">
              {mode === 'login' ? (
                <LogIn className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <h3>{mode === 'login' ? '로그인' : '회원가입'}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="auth-close">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3,3 L13,13 M13,3 L3,13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          {(['login', 'register'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => onSwitchMode(tab)}
              className={`auth-tab${mode === tab ? ' on' : ''}`}
            >
              {tab === 'login' ? '로그인' : '회원가입'}
              {mode === tab && <span className="auth-tab-indicator" aria-hidden="true" />}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="auth-body">
          {mode === 'login' ? (
            <LoginForm onSuccess={onSuccess} onSwitchToRegister={() => onSwitchMode('register')} />
          ) : (
            <SignupForm onSignedUp={handleSignedUp} onSwitchToLogin={() => onSwitchMode('login')} />
          )}
        </div>
      </div>
    </div>
  )
}
