import { useCallback } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import type { AuthMode } from '../model/useAuthModal'
import { LoginForm } from '../login'
import { SignupForm } from '../signup'

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
 */
export function AuthModal({ isOpen, mode, onClose, onSwitchMode, onSuccess }: AuthModalProps) {
  const handleSignedUp = useCallback(() => {
    // 가입 완료 → 로그인 탭으로 전환 (원본 동작 유지). id prefill 은 추후 확장.
    onSwitchMode('login')
  }, [onSwitchMode])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(74, 59, 42, 0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
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
        {/* 워시 테이프 데코 */}
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

        {/* Header */}
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
              {mode === 'login' ? (
                <LogIn className="w-5 h-5" style={{ color: '#5b3a18' }} />
              ) : (
                <UserPlus className="w-5 h-5" style={{ color: '#5b3a18' }} />
              )}
            </div>
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
              {mode === 'login' ? '로그인' : '회원가입'}
            </h3>
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

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '2px dashed rgba(163, 117, 72, 0.35)', margin: '0 8px' }}>
          {(['login', 'register'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => onSwitchMode(tab)}
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

        {/* Body */}
        <div className="overflow-y-auto" style={{ maxHeight: '65vh' }}>
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
