import { useCallback } from 'react'
import { LogIn, UserPlus, X } from 'lucide-react'
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
 * 로그인/회원가입 통합 모달. 탭 UI 내부에서 `LoginForm` 과 `SignupForm` 을 전환.
 *
 * 백드롭 클릭 시 닫힘, 내부 컨테이너 클릭은 이벤트 전파 차단.
 */
export function AuthModal({ isOpen, mode, onClose, onSwitchMode, onSuccess }: AuthModalProps) {
  const handleSignedUp = useCallback(() => {
    // 가입 완료 → 로그인 탭으로 전환 (원본 동작 유지). id prefill 은 추후 확장.
    onSwitchMode('login')
  }, [onSwitchMode])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#f0e6c0] rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.7)] border-4 border-[#2a1b12] w-full max-w-md relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#2a1b12] px-6 py-5 flex items-center justify-between border-b border-[#4a3a24]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2d5a27] rounded-xl flex items-center justify-center border border-[#b4dc8c]/40 shadow-[0_0_14px_rgba(180,220,140,0.35)]">
              {mode === 'login' ? (
                <LogIn className="w-5 h-5 text-[#b4dc8c]" />
              ) : (
                <UserPlus className="w-5 h-5 text-[#b4dc8c]" />
              )}
            </div>
            <h3 className="text-xl text-[#f0e6c0] font-bold">{mode === 'login' ? '로그인' : '회원가입'}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 rounded-full bg-[#2d5a27]/50 hover:bg-[#2d5a27] text-[#b4c4a4] hover:text-[#f0e6c0] border border-[#b4dc8c]/30 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-[#e8ddb4] flex border-b border-[#8b7a52]/40">
          {(['login', 'register'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => onSwitchMode(tab)}
              className={`flex-1 py-3 text-base font-bold transition-colors ${
                mode === tab
                  ? 'bg-[#f0e6c0] text-[#2d5a27] border-b-2 border-[#2d5a27]'
                  : 'text-[#8b7a52] hover:text-[#2d5a27]'
              }`}
            >
              {tab === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="max-h-[65vh] overflow-y-auto">
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
