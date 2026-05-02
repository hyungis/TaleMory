import { useCallback, useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { isApiError } from '../../../../shared/api'
import { TermsCheckboxes } from '../../terms'
import { useSignupPost } from '../model/useSignupPost'
import '../../styles/auth.css'

interface SignupFormValues {
  id: string
  password: string
  email: string
  name: string
  nickname: string
  phone: string
  smsAgree: boolean
  marketingAgree: boolean
}

const INITIAL_VALUES: SignupFormValues = {
  id: '',
  password: '',
  email: '',
  name: '',
  nickname: '',
  phone: '',
  smsAgree: false,
  marketingAgree: false,
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[0-9\-+\s]{7,}$/

function validate(values: SignupFormValues): string | null {
  if (!values.id.trim()) return '아이디를 입력해주세요.'
  if (values.id.trim().length < 4) return '아이디는 4자 이상이어야 해요.'
  if (!values.password) return '비밀번호를 입력해주세요.'
  if (values.password.length < 6) return '비밀번호는 6자 이상이어야 해요.'
  if (!values.email.trim() || !EMAIL_PATTERN.test(values.email)) return '올바른 이메일 형식을 입력해주세요.'
  if (!values.name.trim()) return '실명을 입력해주세요.'
  if (!values.nickname.trim()) return '닉네임을 입력해주세요.'
  if (values.phone && !PHONE_PATTERN.test(values.phone)) return '휴대폰 번호 형식을 확인해주세요.'
  return null
}

function getSignupErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return '회원가입 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.'
  }
  if (error.code === 'AUTH_001') return '이미 사용 중인 아이디입니다.'
  if (error.code === 'AUTH_002') return '이미 사용 중인 이메일입니다.'
  if (error.code === 'NETWORK_ERROR') return '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.'
  if (error.code === 'REQUEST_TIMEOUT') return '응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.'
  return error.message
}

interface SignupFormProps {
  onSignedUp: (idHint: string) => void
  onSwitchToLogin: () => void
}

/**
 * 회원가입 폼 — paper-craft 톤. 스타일은 `auth.css` 의 `auth-*` 클래스 사용.
 */
export function SignupForm({ onSignedUp, onSwitchToLogin }: SignupFormProps) {
  const [values, setValues] = useState<SignupFormValues>(INITIAL_VALUES)
  const [error, setError] = useState('')
  const { isPending, signup } = useSignupPost()

  const handleChange = useCallback(
    <K extends keyof SignupFormValues>(key: K, value: SignupFormValues[K]) => {
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
        await signup({
          loginId: values.id.trim(),
          password: values.password,
          email: values.email.trim(),
          name: values.name.trim(),
          nickname: values.nickname.trim(),
          phone: values.phone.trim() || undefined,
          agreeSms: values.smsAgree,
          agreeMarketing: values.marketingAgree,
        })

        setError('')
        alert(`"${values.nickname.trim()}" 님 가입이 완료됐어요! 로그인 해주세요.`)
        onSignedUp(values.id.trim())
      } catch (submitError) {
        setError(getSignupErrorMessage(submitError))
      }
    },
    [isPending, onSignedUp, signup, values],
  )

  return (
    <form className="auth-form" onSubmit={handleSubmit} aria-busy={isPending}>
      <div>
        <label className="auth-label">
          아이디 <span className="required">*</span>
        </label>
        <input
          type="text"
          className="auth-input"
          value={values.id}
          disabled={isPending}
          onChange={e => handleChange('id', e.target.value)}
          autoComplete="username"
          placeholder="4자 이상"
        />
      </div>
      <div>
        <label className="auth-label">
          비밀번호 <span className="required">*</span>
        </label>
        <input
          type="password"
          className="auth-input"
          value={values.password}
          disabled={isPending}
          onChange={e => handleChange('password', e.target.value)}
          autoComplete="new-password"
          placeholder="6자 이상"
        />
      </div>
      <div>
        <label className="auth-label">
          이메일 <span className="required">*</span>
        </label>
        <input
          type="email"
          className="auth-input"
          value={values.email}
          disabled={isPending}
          onChange={e => handleChange('email', e.target.value)}
          autoComplete="email"
          placeholder="example@email.com"
        />
      </div>
      <div className="auth-grid-2">
        <div>
          <label className="auth-label">
            실명 <span className="required">*</span>
          </label>
          <input
            type="text"
            className="auth-input"
            value={values.name}
            disabled={isPending}
            onChange={e => handleChange('name', e.target.value)}
            autoComplete="name"
            placeholder="홍길동"
          />
        </div>
        <div>
          <label className="auth-label">
            닉네임 <span className="required">*</span>
          </label>
          <input
            type="text"
            className="auth-input"
            value={values.nickname}
            disabled={isPending}
            onChange={e => handleChange('nickname', e.target.value)}
            placeholder="해솔맘"
          />
        </div>
      </div>
      <div>
        <label className="auth-label">
          휴대폰 <span className="optional">(선택)</span>
        </label>
        <input
          type="tel"
          className="auth-input"
          value={values.phone}
          disabled={isPending}
          onChange={e => handleChange('phone', e.target.value)}
          autoComplete="tel"
          placeholder="010-1234-5678"
        />
      </div>

      <TermsCheckboxes
        smsAgree={values.smsAgree}
        marketingAgree={values.marketingAgree}
        onChange={(key, value) => handleChange(key, value)}
      />

      {error && (
        <div className="auth-error">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <button type="submit" className="auth-btn-primary" disabled={isPending}>
        {isPending ? '가입 처리 중...' : '가입하기'}
      </button>

      <p className="auth-footer-text">
        이미 계정이 있으신가요?{' '}
        <button type="button" className="auth-link" onClick={onSwitchToLogin}>
          로그인
        </button>
      </p>
    </form>
  )
}
