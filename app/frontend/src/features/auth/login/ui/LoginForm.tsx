import { useCallback, useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { KakaoOAuthButton } from '../../oauth'

interface LoginFormValues {
  id: string
  password: string
}

interface LoginFormProps {
  /** 로그인 성공 시 호출. 실제 API 연동 전에는 기본값 검증만 통과하면 바로 호출. */
  onSuccess: () => void
  /** 탭 전환 요청 — 회원가입 링크 클릭 시. */
  onSwitchToRegister: () => void
}

/**
 * 로그인 폼.
 * TODO(S14P31S210-75): 실제 `/api/auth/login` 연동 훅(`useLoginPost`) 추가 시 shared/api 경유.
 */
export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [values, setValues] = useState<LoginFormValues>({ id: '', password: '' })
  const [error, setError] = useState('')

  const handleChange = useCallback(<K extends keyof LoginFormValues>(key: K, value: LoginFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!values.id.trim()) {
        setError('아이디를 입력해주세요.')
        return
      }
      if (!values.password) {
        setError('비밀번호를 입력해주세요.')
        return
      }
      // TODO(S14P31S210-75): 실제 로그인 API 연동
      setError('')
      onSuccess()
    },
    [values, onSuccess],
  )

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div>
        <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">아이디</label>
        <input
          type="text"
          value={values.id}
          onChange={e => handleChange('id', e.target.value)}
          placeholder="아이디를 입력하세요"
          className="w-full p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60"
        />
      </div>
      <div>
        <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">비밀번호</label>
        <input
          type="password"
          value={values.password}
          onChange={e => handleChange('password', e.target.value)}
          placeholder="비밀번호를 입력하세요"
          className="w-full p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60"
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
        className="w-full bg-[#2d5a27] text-[#f0e6c0] py-3.5 rounded-xl border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.45)] hover:bg-[#3d6f34] transition-all font-bold text-lg"
      >
        로그인
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
