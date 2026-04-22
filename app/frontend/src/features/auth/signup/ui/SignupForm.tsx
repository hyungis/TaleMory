import { useCallback, useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { isApiError } from '../../../../shared/api'
import { TermsCheckboxes } from '../../terms'
import { useSignupPost } from '../model/useSignupPost'

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
  // shared/api 가 정규화한 에러를 바탕으로 회원가입 문구를 한 곳에서 정리한다.
  if (!isApiError(error)) {
    return '회원가입 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.'
  }

  if (error.code === 'AUTH_001') {
    return '이미 사용 중인 아이디입니다.'
  }

  if (error.code === 'AUTH_002') {
    return '이미 사용 중인 이메일입니다.'
  }

  if (error.code === 'NETWORK_ERROR') {
    return '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.'
  }

  if (error.code === 'REQUEST_TIMEOUT') {
    return '응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.'
  }

  return error.message
}

interface SignupFormProps {
  /** 가입 성공 후 로그인 탭으로 자동 전환 요청. id 는 prefill 힌트. */
  onSignedUp: (idHint: string) => void
  /** 로그인 탭으로 수동 이동. */
  onSwitchToLogin: () => void
}

/**
 * 회원가입 폼.
 * 실제 `/api/auth/signup` 연동은 `useSignupPost` + `shared/api` 경유로 처리한다.
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
    <form onSubmit={handleSubmit} className="p-6 space-y-4" aria-busy={isPending}>
      <div>
        <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">
          아이디 <span className="text-[#8b3a2a]">*</span>
        </label>
        <input
          type="text"
          value={values.id}
          disabled={isPending}
          onChange={e => handleChange('id', e.target.value)}
          autoComplete="username"
          placeholder="4자 이상"
          className="w-full p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">
          비밀번호 <span className="text-[#8b3a2a]">*</span>
        </label>
        <input
          type="password"
          value={values.password}
          disabled={isPending}
          onChange={e => handleChange('password', e.target.value)}
          autoComplete="new-password"
          placeholder="6자 이상"
          className="w-full p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>
      <div>
        <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">
          이메일 <span className="text-[#8b3a2a]">*</span>
        </label>
        <input
          type="email"
          value={values.email}
          disabled={isPending}
          onChange={e => handleChange('email', e.target.value)}
          autoComplete="email"
          placeholder="example@email.com"
          className="w-full p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">
            실명 <span className="text-[#8b3a2a]">*</span>
          </label>
          <input
            type="text"
            value={values.name}
            disabled={isPending}
            onChange={e => handleChange('name', e.target.value)}
            autoComplete="name"
            placeholder="홍길동"
            className="w-full p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">
            닉네임 <span className="text-[#8b3a2a]">*</span>
          </label>
          <input
            type="text"
            value={values.nickname}
            disabled={isPending}
            onChange={e => handleChange('nickname', e.target.value)}
            placeholder="해솔맘"
            className="w-full p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">
          휴대폰 <span className="text-xs text-[#8b7a52]/70">(선택)</span>
        </label>
        <input
          type="tel"
          value={values.phone}
          disabled={isPending}
          onChange={e => handleChange('phone', e.target.value)}
          autoComplete="tel"
          placeholder="010-1234-5678"
          className="w-full p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      <TermsCheckboxes
        smsAgree={values.smsAgree}
        marketingAgree={values.marketingAgree}
        onChange={(key, value) => handleChange(key, value)}
      />

      {error && (
        <div className="bg-[#8b3a2a]/10 border border-[#8b3a2a]/40 text-[#8b3a2a] text-sm px-3 py-2 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#2d5a27] text-[#f0e6c0] py-3.5 rounded-xl border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.45)] hover:bg-[#3d6f34] transition-all font-bold text-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)]"
      >
        {isPending ? '가입 처리 중...' : '가입하기'}
      </button>

      <p className="text-center text-[#8b7a52] text-sm pt-2">
        이미 계정이 있으신가요?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-[#2d5a27] font-bold hover:underline"
        >
          로그인
        </button>
      </p>
    </form>
  )
}
