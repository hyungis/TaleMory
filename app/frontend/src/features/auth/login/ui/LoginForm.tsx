import { useCallback, useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { isApiError } from '../../../../shared/api'
import { KakaoOAuthButton } from '../../oauth'
import { setAuthSession } from '../../model/authSession'
import { useLoginPost } from '../model/useLoginPost'
import '../../styles/auth.css'

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

/**
 * 로그인 폼 — paper-craft 톤. 스타일은 `auth.css` 의 `auth-*` 클래스 사용.
 */
export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [values, setValues] = useState<LoginFormValues>(INITIAL_VALUES)
  const [error, setError] = useState('')
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

      try {
        const result = await login({
          loginId: values.id.trim(),
          password: values.password,
        })
        setAuthSession(result)
        setError('')
        onSuccess()
      } catch (submitError) {
        setError(getLoginErrorMessage(submitError))
      }
    },
    [isPending, login, onSuccess, values],
  )

  return (
    <form className="auth-form" onSubmit={handleSubmit} aria-busy={isPending}>
      <div>
        <label className="auth-label">아이디</label>
        <input
          type="text"
          className="auth-input"
          value={values.id}
          disabled={isPending}
          onChange={e => handleChange('id', e.target.value)}
          autoComplete="username"
          placeholder="아이디를 입력하세요"
        />
      </div>

      <div>
        <label className="auth-label">비밀번호</label>
        <input
          type="password"
          className="auth-input"
          value={values.password}
          disabled={isPending}
          onChange={e => handleChange('password', e.target.value)}
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
        />
      </div>

      {error && (
        <div className="auth-error">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <button type="submit" className="auth-btn-primary" disabled={isPending}>
        {isPending ? '로그인 중...' : '로그인'}
      </button>

      {/* 손그림 wavy 구분선 + 또는 */}
      <div className="auth-divider">
        <div className="line" aria-hidden="true" />
        <span className="label">또는</span>
        <div className="line" aria-hidden="true" />
      </div>

      <KakaoOAuthButton />

      <p className="auth-footer-text">
        아직 계정이 없으신가요?{' '}
        <button type="button" className="auth-link" onClick={onSwitchToRegister}>
          회원가입
        </button>
      </p>
    </form>
  )
}
