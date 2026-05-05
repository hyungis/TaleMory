import { useCallback, useState, type CSSProperties, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { isApiError } from '../../../../shared/api'
import { KakaoOAuthButton } from '../../oauth'
import { setAuthSession } from '../../model/authSession'
import { useLoginPost } from '../model/useLoginPost'
import type { LoginRequest } from '../types'

interface LoginFormValues {
  id: string
  password: string
}

interface LoginFormProps {
  /** 로그인 성공 시 호출. */
  onSuccess: () => void
  /** 탭 전환 요청 — 회원가입 링크 클릭 시. */
  onSwitchToRegister: () => void
}

const INITIAL_VALUES: LoginFormValues = {
  id: '',
  password: '',
}

const WITHDRAWN_ACCOUNT_CODE = 'AUTH_007'

function validate(values: LoginFormValues): string | null {
  if (!values.id.trim()) return '아이디를 입력해주세요.'
  if (!values.password) return '비밀번호를 입력해주세요.'
  return null
}

function getLoginErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return '로그인 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.'
  }
  if (error.code === 'NETWORK_ERROR') {
    return '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.'
  }
  if (error.code === 'REQUEST_TIMEOUT') {
    return '응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.'
  }
  return error.message
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-display)',
  fontSize: 16,
  fontWeight: 700,
  color: '#6b5638',
  marginBottom: 6,
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  background: '#f7eccd',
  border: '2px solid #a37548',
  color: '#4a3b2a',
  fontFamily: 'var(--font-display)',
  fontSize: 17,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxShadow: 'inset 0 1px 2px rgba(140, 100, 60, 0.08)',
}

/**
 * 로그인 폼 — paper-craft 톤.
 */
export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [values, setValues] = useState<LoginFormValues>(INITIAL_VALUES)
  const [error, setError] = useState('')
  const [restoreRequest, setRestoreRequest] = useState<LoginRequest | null>(null)
  const { isPending, login } = useLoginPost()

  const handleChange = useCallback(
    <K extends keyof LoginFormValues>(key: K, value: LoginFormValues[K]) => {
      setError('')
      setValues(prev => ({ ...prev, [key]: value }))
    },
    [],
  )

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (isPending) return

      const validationError = validate(values)
      if (validationError) {
        setError(validationError)
        return
      }

      const request: LoginRequest = {
          loginId: values.id.trim(),
          password: values.password,
      }

      try {
        const result = await login(request)
        setAuthSession(result)
        setError('')
        onSuccess()
      } catch (submitError) {
        if (isApiError(submitError) && submitError.code === WITHDRAWN_ACCOUNT_CODE) {
          setError('')
          setRestoreRequest(request)
          return
        }

        setError(getLoginErrorMessage(submitError))
      }
    },
    [isPending, login, onSuccess, values],
  )

  const handleRestoreCancel = useCallback(() => {
    if (!isPending) {
      setRestoreRequest(null)
    }
  }, [isPending])

  const handleRestoreConfirm = useCallback(async () => {
    if (restoreRequest === null || isPending) return

    try {
      const result = await login({
        ...restoreRequest,
        restoreConfirmed: true,
      })
      setAuthSession(result)
      setError('')
      setRestoreRequest(null)
      onSuccess()
    } catch (restoreError) {
      setRestoreRequest(null)
      setError(getLoginErrorMessage(restoreError))
    }
  }, [isPending, login, onSuccess, restoreRequest])

  return (
    <>
      <form
        onSubmit={handleSubmit}
        aria-busy={isPending}
        style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
      <div>
        <label style={labelStyle}>아이디</label>
        <input
          type="text"
          value={values.id}
          disabled={isPending}
          onChange={e => handleChange('id', e.target.value)}
          autoComplete="username"
          placeholder="아이디를 입력하세요"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>비밀번호</label>
        <input
          type="password"
          value={values.password}
          disabled={isPending}
          onChange={e => handleChange('password', e.target.value)}
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
          style={inputStyle}
        />
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(196, 114, 84, 0.12)',
            border: '1.5px solid rgba(196, 114, 84, 0.45)',
            color: '#8c3a1f',
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            padding: '8px 12px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        style={{
          width: '100%',
          background: '#7a9968',
          color: '#fdfaf0',
          border: '2px solid #5f7d50',
          padding: '14px 20px',
          borderRadius: 999,
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 700,
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.6 : 1,
          boxShadow: '0 3px 0 #5f7d50, 0 6px 14px rgba(95, 125, 80, 0.25)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          marginTop: 6,
        }}
      >
        {isPending ? '로그인 중...' : '로그인'}
      </button>

      {/* 손그림 wavy 구분선 + 또는 */}
      <div className="flex items-center gap-3" style={{ margin: '4px 0' }}>
        <div
          aria-hidden="true"
          style={{
            flex: 1,
            height: 6,
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 6' preserveAspectRatio='none'><path d='M0,3 Q 25 0, 50 3 T 100 3 T 150 3 T 200 3' stroke='%23a37548' stroke-width='1.4' fill='none' stroke-linecap='round'/></svg>\")",
            backgroundRepeat: 'no-repeat',
            backgroundSize: '100% 100%',
            opacity: 0.55,
          }}
        />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#8a7558', fontWeight: 700 }}>
          또는
        </span>
        <div
          aria-hidden="true"
          style={{
            flex: 1,
            height: 6,
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 6' preserveAspectRatio='none'><path d='M0,3 Q 25 0, 50 3 T 100 3 T 150 3 T 200 3' stroke='%23a37548' stroke-width='1.4' fill='none' stroke-linecap='round'/></svg>\")",
            backgroundRepeat: 'no-repeat',
            backgroundSize: '100% 100%',
            opacity: 0.55,
          }}
        />
      </div>

      <KakaoOAuthButton />

      <p
        className="text-center"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          color: '#8a7558',
          paddingTop: 4,
        }}
      >
        아직 계정이 없으신가요?{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          style={{
            background: 'none',
            border: 'none',
            color: '#5f7d50',
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          회원가입
        </button>
      </p>
      </form>

      {restoreRequest && (
        <LoginRestoreConfirmDialog
          isPending={isPending}
          onCancel={handleRestoreCancel}
          onConfirm={handleRestoreConfirm}
        />
      )}
    </>
  )
}

function LoginRestoreConfirmDialog({
  isPending,
  onCancel,
  onConfirm,
}: {
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="login-restore-account-title"
      onClick={() => {
        if (!isPending) onCancel()
      }}
    >
      <div
        className="w-full max-w-sm rounded-[2rem] border-4 border-[#2a1b12] bg-[#f0e6c0] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
        onClick={event => event.stopPropagation()}
      >
        <h3 id="login-restore-account-title" className="mb-3 text-xl font-bold text-[#2a1b12]">
          계정 복구
        </h3>
        <p className="mb-5 text-sm leading-6 text-[#6a5632]">
          탈퇴한 계정입니다. 계정을 복구하고 로그인할까요?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-xl border border-[#8b7a52]/60 bg-[#e8ddb4] py-3 font-bold text-[#2a1b12] disabled:cursor-not-allowed disabled:opacity-60"
          >
            아니오
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-xl border border-[#b4dc8c]/40 bg-[#2d5a27] py-3 font-bold text-[#f0e6c0] shadow-[0_4px_0_#1a3a14] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? '복구 중...' : '예'}
          </button>
        </div>
      </div>
    </div>
  )
}
