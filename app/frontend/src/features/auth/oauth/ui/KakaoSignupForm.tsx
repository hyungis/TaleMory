import { useCallback, useState, type FormEvent } from 'react'
import { AlertCircle, UserPlus } from 'lucide-react'
import { isApiError } from '../../../../shared/api'
import { formatPhoneNumber } from '../../../../shared/lib'
import { getNicknameAvailability } from '../../api/getAuthAvailability'
import { TermsCheckboxes } from '../../terms'
import { useKakaoSignupPost } from '../model/useKakaoSignupPost'
import type { KakaoSignupProfile, KakaoSignupRequest } from '../types'
import type { LoginResponse } from '../../login'

interface KakaoSignupFormValues {
  email: string
  name: string
  nickname: string
  phone: string
  smsAgree: boolean
  marketingAgree: boolean
}

interface KakaoSignupFormProps {
  signupToken: string
  profile: KakaoSignupProfile
  onSuccess: (result: LoginResponse) => void
  onCancel: () => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[0-9\-+\s]{7,}$/
const WITHDRAWN_ACCOUNT_CODE = 'AUTH_007'

type NicknameCheckStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error'

interface NicknameCheckState {
  status: NicknameCheckStatus
  value: string
}

const INITIAL_NICKNAME_CHECK: NicknameCheckState = {
  status: 'idle',
  value: '',
}

function isNicknameCheckConfirmed(state: NicknameCheckState, nickname: string): boolean {
  return state.status === 'available' && state.value === nickname.trim()
}

function getNicknameCheckMessage(state: NicknameCheckState, nickname: string): string | null {
  if (state.status === 'idle' || state.value !== nickname.trim()) return null
  if (state.status === 'checking') return '닉네임 중복 여부를 확인하고 있어요.'
  if (state.status === 'available') return '사용 가능한 닉네임입니다.'
  if (state.status === 'unavailable') return '이미 사용 중인 닉네임입니다.'
  return '닉네임 중복 확인에 실패했어요. 잠시 후 다시 시도해주세요.'
}

function getNicknameCheckMessageClassName(status: NicknameCheckStatus): string {
  if (status === 'available') return 'text-[#2d5a27]'
  if (status === 'unavailable' || status === 'error') return 'text-[#8b3a2a]'
  return 'text-[#6a5632]'
}

function createInitialValues(profile: KakaoSignupProfile): KakaoSignupFormValues {
  return {
    email: profile.email.trim(),
    name: profile.name ?? '',
    nickname: profile.nickname ?? '',
    phone: formatPhoneNumber(profile.phone ?? ''),
    smsAgree: false,
    marketingAgree: false,
  }
}

function getKakaoEmail(profile: KakaoSignupProfile): string {
  return profile.email.trim()
}

function validate(values: KakaoSignupFormValues): string | null {
  if (!values.email.trim() || !EMAIL_PATTERN.test(values.email.trim())) return '올바른 이메일 형식을 입력해주세요.'
  if (!values.name.trim()) return '이름을 입력해주세요.'
  if (!values.nickname.trim()) return '닉네임을 입력해주세요.'
  if (values.phone && !PHONE_PATTERN.test(values.phone)) return '휴대폰 번호 형식을 확인해주세요.'
  return null
}

function getKakaoSignupErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return '카카오 회원가입 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.'
  }

  if (error.code === 'AUTH_002') {
    return '이미 사용 중인 이메일입니다.'
  }

  if (error.code === 'USER_002') {
    return '이미 사용 중인 닉네임입니다.'
  }

  if (error.code === 'AUTH_008') {
    return '카카오 인증 시간이 만료됐어요. 다시 카카오로 시작해주세요.'
  }

  if (error.code === 'NETWORK_ERROR') {
    return '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.'
  }

  if (error.code === 'REQUEST_TIMEOUT') {
    return '응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.'
  }

  return error.message
}

export function KakaoSignupForm({ signupToken, profile, onSuccess, onCancel }: KakaoSignupFormProps) {
  const [values, setValues] = useState<KakaoSignupFormValues>(() => createInitialValues(profile))
  const [error, setError] = useState('')
  const [nicknameCheck, setNicknameCheck] = useState<NicknameCheckState>(INITIAL_NICKNAME_CHECK)
  const [restoreRequest, setRestoreRequest] = useState<KakaoSignupRequest | null>(null)
  const { isPending, signup } = useKakaoSignupPost()
  const kakaoEmail = getKakaoEmail(profile)

  const handleChange = useCallback(
    <K extends keyof KakaoSignupFormValues>(key: K, value: KakaoSignupFormValues[K]) => {
      setError('')
      setValues(prev => ({ ...prev, [key]: value }))
    },
    [],
  )

  const handleNicknameCheck = useCallback(async () => {
    const nickname = values.nickname.trim()
    if (!nickname) {
      setError('닉네임을 입력해주세요.')
      return
    }

    setError('')
    setNicknameCheck({ status: 'checking', value: nickname })

    try {
      const result = await getNicknameAvailability(nickname)
      setNicknameCheck({ status: result.available ? 'available' : 'unavailable', value: nickname })
    } catch (checkError) {
      setNicknameCheck({ status: 'error', value: nickname })
      setError(getKakaoSignupErrorMessage(checkError))
    }
  }, [values.nickname])

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (isPending) return

      const validationError = validate(values)
      if (validationError) {
        setError(validationError)
        return
      }

      if (!isNicknameCheckConfirmed(nicknameCheck, values.nickname)) {
        setError(
          nicknameCheck.status === 'unavailable' && nicknameCheck.value === values.nickname.trim()
            ? '이미 사용 중인 닉네임입니다.'
            : '닉네임 중복 확인을 완료해주세요.',
        )
        return
      }

      const request: KakaoSignupRequest = {
        signupToken,
        email: kakaoEmail,
        name: values.name.trim(),
        nickname: values.nickname.trim(),
        phone: values.phone.trim() || undefined,
        agreeSms: values.smsAgree,
        agreeMarketing: values.marketingAgree,
      }

      try {
        const result = await signup(request)

        setError('')
        onSuccess(result)
      } catch (submitError) {
        if (isApiError(submitError) && submitError.code === WITHDRAWN_ACCOUNT_CODE) {
          setError('')
          setRestoreRequest(request)
          return
        }

        setError(getKakaoSignupErrorMessage(submitError))
      }
    },
    [isPending, kakaoEmail, nicknameCheck, onSuccess, signup, signupToken, values],
  )

  const handleRestoreCancel = useCallback(() => {
    if (!isPending) {
      setRestoreRequest(null)
    }
  }, [isPending])

  const handleRestoreConfirm = useCallback(async () => {
    if (restoreRequest === null || isPending) return

    try {
      const result = await signup({
        ...restoreRequest,
        restoreConfirmed: true,
      })
      setError('')
      setRestoreRequest(null)
      onSuccess(result)
    } catch (restoreError) {
      setRestoreRequest(null)
      setError(getKakaoSignupErrorMessage(restoreError))
    }
  }, [isPending, onSuccess, restoreRequest, signup])

  const nicknameCheckMessage = getNicknameCheckMessage(nicknameCheck, values.nickname)

  return (
    <div className="min-h-screen bg-[#f6f0da] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border-4 border-[#2a1b12] bg-[#f0e6c0] shadow-[0_20px_60px_rgba(0,0,0,0.28)] overflow-hidden">
        <div className="bg-[#2a1b12] px-6 py-5 flex items-center gap-3 border-b border-[#4a3a24]">
          <div className="w-10 h-10 bg-[#2d5a27] rounded-xl flex items-center justify-center border border-[#b4dc8c]/40">
            <UserPlus className="w-5 h-5 text-[#b4dc8c]" />
          </div>
          <div>
            <p className="text-sm text-[#b4dc8c] font-bold">카카오 인증 완료</p>
            <h1 className="text-xl text-[#f0e6c0] font-bold">회원 정보 입력</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4" aria-busy={isPending}>
          <div>
            <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">
              이메일 <span className="text-[#8b3a2a]">*</span>
            </label>
            <input
              type="email"
              value={kakaoEmail}
              readOnly
              autoComplete="email"
              placeholder="example@email.com"
              className="w-full p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60"
            />
            <p className="mt-1.5 text-xs leading-5 text-[#6a5632]">
              카카오 계정에서 인증된 이메일이라 수정할 수 없어요.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[#8b7a52] mb-1.5 font-bold">
                이름 <span className="text-[#8b3a2a]">*</span>
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={values.nickname}
                  disabled={isPending}
                  onChange={e => {
                    setNicknameCheck(INITIAL_NICKNAME_CHECK)
                    handleChange('nickname', e.target.value)
                  }}
                  placeholder="해솔맘"
                  className="min-w-0 flex-1 p-3 rounded-xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 placeholder-[#8b7a52]/60 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  disabled={isPending || nicknameCheck.status === 'checking'}
                  onClick={handleNicknameCheck}
                  className="shrink-0 rounded-xl border-2 border-[#2d5a27] bg-[#e4efd1] px-3 text-sm font-bold text-[#2d5a27] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {nicknameCheck.status === 'checking' ? '확인 중' : '중복 확인'}
                </button>
              </div>
              {nicknameCheckMessage && (
                <p className={`mt-1.5 text-xs leading-5 ${getNicknameCheckMessageClassName(nicknameCheck.status)}`}>
                  {nicknameCheckMessage}
                </p>
              )}
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
              onChange={e => handleChange('phone', formatPhoneNumber(e.target.value))}
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
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#2d5a27] text-[#f0e6c0] py-3.5 rounded-xl border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.45)] hover:bg-[#3d6f34] transition-all font-bold text-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)]"
          >
            {isPending ? '가입 처리 중...' : '가입하고 시작하기'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="w-full text-[#8b7a52] text-sm font-bold hover:text-[#2d5a27] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            다음에 할게요
          </button>
        </form>
      </div>
      {restoreRequest && (
        <KakaoRestoreConfirmDialog
          isPending={isPending}
          onCancel={handleRestoreCancel}
          onConfirm={handleRestoreConfirm}
        />
      )}
    </div>
  )
}

function KakaoRestoreConfirmDialog({
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
      className="fixed inset-0 z-[10001] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="kakao-restore-title"
      onClick={() => {
        if (!isPending) onCancel()
      }}
    >
      <div
        className="w-full max-w-sm rounded-[2rem] border-4 border-[#2a1b12] bg-[#f0e6c0] shadow-[0_20px_60px_rgba(0,0,0,0.45)] p-6"
        onClick={event => event.stopPropagation()}
      >
        <h2 id="kakao-restore-title" className="text-xl text-[#2a1b12] font-bold mb-3">
          계정 복구
        </h2>
        <p className="text-sm leading-6 text-[#6a5632] mb-5">
          기존에 가입한 이력이 있습니다. 복구를 진행할까요?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 bg-[#e8ddb4] text-[#2a1b12] py-3 rounded-xl border border-[#8b7a52]/60 font-bold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            아니오
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 bg-[#2d5a27] text-[#f0e6c0] py-3 rounded-xl border border-[#b4dc8c]/40 font-bold shadow-[0_4px_0_#1a3a14] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? '복구 중...' : '예'}
          </button>
        </div>
      </div>
    </div>
  )
}
