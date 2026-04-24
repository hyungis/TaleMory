import { useCallback, useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { isApiError } from '../../../../shared/api'
import { KakaoOAuthButton } from '../../oauth'
import { setAuthSession } from '../../model/authSession'
import { useLoginPost } from '../model/useLoginPost'

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
  // shared/api 가 정규화한 에러를 바탕으로 사용자 문구를 한 곳에서 정리한다.
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
 * 로그인 폼.
 * 실제 `/api/auth/login` 연동은 `useLoginPost` + `shared/api` 경유로 처리한다.
 */
export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [values, setValues] = useState<LoginFormValues>(INITIAL_VALUES)
  const [error, setError] = useState('')
  const { isPending, login } = useLoginPost()

  const handleChange = useCallback(<K extends keyof LoginFormValues>(key: K, value: LoginFormValues[K]) => {
    setError('')
    setValues(prev => ({ ...prev, [key]: value }))
  }, [])

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

        // 로그인 성공 시 토큰/사용자 정보를 저장해 이후 요청에서 자동으로 인증 헤더를 붙일 수 있게 한다.
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
    <form onSubmit={handleSubmit} className="p-6 space-y-4" aria-busy={isPending}>
      <div>
        <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">아이디</label>
        <input
          type="text"
          value={values.id}
          disabled={isPending}
          onChange={e => handleChange('id', e.target.value)}
          autoComplete="username"
          placeholder="아이디를 입력하세요"
          className="w-full p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">비밀번호</label>
        <input
          type="password"
          value={values.password}
          disabled={isPending}
          onChange={e => handleChange('password', e.target.value)}
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
          className="w-full p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

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
        {isPending ? '로그인 중...' : '로그인'}
      </button>

      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-[#8b7a52]/40"></div>
        <span className="text-[#8b7a52] text-xs font-bold">또는</span>
        <div className="flex-1 h-px bg-[#8b7a52]/40"></div>
      </div>

      <KakaoOAuthButton onSuccess={onSuccess} />

      <p className="text-center text-[#8b7a52] text-sm pt-2">
        아직 계정이 없으신가요?{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-[#2d5a27] font-bold hover:underline"
        >
          회원가입
        </button>
      </p>
    </form>
  )
}
