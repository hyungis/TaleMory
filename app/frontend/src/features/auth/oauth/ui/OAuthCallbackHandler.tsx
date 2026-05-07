import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import { isApiError } from '../../../../shared/api'
import { ROUTES } from '../../../../shared/constants'
import { FeedbackDialog } from '../../../../shared/ui'
import { mapLoginResponse } from '../../login'
import { clearAuthSession, setAuthSession } from '../../model/authSession'
import { postKakaoCallback } from '../api/postKakaoCallback'
import { postKakaoSignup } from '../api/postKakaoSignup'
import { parseOauthCallbackPayload } from '../lib/parseOauthCallbackPayload'
import type { KakaoSignupProfile } from '../types'

interface KakaoRestoreDraft {
  signupToken: string
  profile: KakaoSignupProfile
  passwordRequired: boolean
}

interface KakaoLinkDraft {
  signupToken: string
  profile: KakaoSignupProfile
}

export function OAuthCallbackHandler() {
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [restoreDraft, setRestoreDraft] = useState<KakaoRestoreDraft | null>(null)
  const [linkDraft, setLinkDraft] = useState<KakaoLinkDraft | null>(null)
  const [isRestorePending, setIsRestorePending] = useState(false)
  const [isLinkPending, setIsLinkPending] = useState(false)
  const [restorePassword, setRestorePassword] = useState('')
  const [restorePasswordError, setRestorePasswordError] = useState('')

  useEffect(() => {
    let isActive = true
    const searchParams = new URLSearchParams(location.search)
    const kakaoError = searchParams.get('error_description') ?? searchParams.get('error')
    const kakaoCode = searchParams.get('code')

    if (kakaoError !== null) {
      clearAuthSession()
      setError(kakaoError)
      return () => {
        isActive = false
      }
    }

    if (kakaoCode !== null && kakaoCode.trim() !== '') {
      const redirectUri = `${window.location.origin}${ROUTES.kakaoCallback}`

      void postKakaoCallback({
        code: kakaoCode,
        redirectUri,
      })
        .then(payload => {
          if (!isActive) return

          if (payload.status === 'SIGNUP_REQUIRED') {
            clearAuthSession()
            navigate(ROUTES.home, {
              replace: true,
              state: {
                kakaoSignupDraft: {
                  signupToken: payload.signupToken,
                  profile: payload.profile,
                },
                kakaoSignupNotice: true,
              },
            })
            return
          }

          if (payload.status === 'RESTORE_REQUIRED') {
            clearAuthSession()
            setLinkDraft(null)
            setRestoreDraft({
              signupToken: payload.signupToken,
              profile: payload.profile,
              passwordRequired: payload.passwordRequired ?? false,
            })
            setRestorePassword('')
            setRestorePasswordError('')
            return
          }

          if (payload.status === 'LINK_REQUIRED') {
            clearAuthSession()
            setRestoreDraft(null)
            setLinkDraft({
              signupToken: payload.signupToken,
              profile: payload.profile,
            })
            return
          }

          const authResult = mapLoginResponse(payload)
          setAuthSession(authResult)
          navigate(ROUTES.home, {
            replace: true,
            state: {
              skipLanding: true,
            },
          })
        })
        .catch(error => {
          if (!isActive) return
          clearAuthSession()
          setError(isApiError(error) ? error.message : 'Kakao login failed. Please try again.')
        })

      return () => {
        isActive = false
      }
    }

    const callbackResult = parseOauthCallbackPayload(location.hash, location.search)

    if (callbackResult.error) {
      clearAuthSession()
      setError(callbackResult.error)
      return
    }

    if (callbackResult.payload === null) {
      clearAuthSession()
      setError('카카오 로그인 응답이 비어 있어요. 다시 시도해주세요.')
      return
    }

    try {
      const authResult = mapLoginResponse(callbackResult.payload)
      setAuthSession(authResult)
      navigate(ROUTES.home, {
        replace: true,
        state: {
          skipLanding: true,
        },
      })
    } catch {
      clearAuthSession()
      setError('카카오 로그인 세션을 저장하지 못했어요. 다시 시도해주세요.')
    }
  }, [location.hash, location.search, navigate])

  const handleKakaoRestoreCancel = () => {
    if (isRestorePending) return

    clearAuthSession()
    setRestoreDraft(null)
    setRestorePassword('')
    setRestorePasswordError('')
    navigate(ROUTES.home, { replace: true })
  }

  const handleKakaoRestoreConfirm = async () => {
    if (restoreDraft === null || isRestorePending) return
    if (restoreDraft.passwordRequired && !restorePassword.trim()) {
      setRestorePasswordError('비밀번호를 입력해주세요.')
      return
    }

    setIsRestorePending(true)
    setRestorePasswordError('')

    try {
      const result = await postKakaoSignup({
        signupToken: restoreDraft.signupToken,
        email: restoreDraft.profile.email,
        name: restoreDraft.profile.name,
        nickname: restoreDraft.profile.nickname,
        phone: restoreDraft.profile.phone ?? undefined,
        password: restorePassword.trim() || undefined,
        restoreConfirmed: true,
      })

      setAuthSession(result)
      setRestoreDraft(null)
      setRestorePassword('')
      navigate(ROUTES.home, {
        replace: true,
        state: {
          skipLanding: true,
        },
      })
    } catch (restoreError) {
      if (isApiError(restoreError) && restoreError.code === 'AUTH_001') {
        setRestorePasswordError('기존 계정 비밀번호를 확인해주세요.')
        return
      }

      clearAuthSession()
      setRestoreDraft(null)
      setRestorePassword('')
      setError(isApiError(restoreError) ? restoreError.message : '카카오 계정을 복구하지 못했어요. 다시 시도해주세요.')
    } finally {
      setIsRestorePending(false)
    }
  }

  const handleKakaoLinkCancel = () => {
    if (isLinkPending) return

    clearAuthSession()
    setLinkDraft(null)
    navigate(ROUTES.home, { replace: true })
  }

  const handleKakaoLinkConfirm = async () => {
    if (linkDraft === null || isLinkPending) return

    setIsLinkPending(true)

    try {
      const result = await postKakaoSignup({
        signupToken: linkDraft.signupToken,
        email: linkDraft.profile.email,
        name: linkDraft.profile.name,
        nickname: linkDraft.profile.nickname,
        phone: linkDraft.profile.phone ?? undefined,
        linkConfirmed: true,
      })

      setAuthSession(result)
      setLinkDraft(null)
      navigate(ROUTES.home, {
        replace: true,
        state: {
          skipLanding: true,
        },
      })
    } catch (linkError) {
      clearAuthSession()
      setLinkDraft(null)
      setError(isApiError(linkError) ? linkError.message : '카카오 계정 연동에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsLinkPending(false)
    }
  }

  if (linkDraft) {
    return (
      <div className="min-h-screen bg-[#f6f0da] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[2rem] border-4 border-[#2a1b12] bg-[#f0e6c0] shadow-[0_20px_60px_rgba(0,0,0,0.28)] p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#2d5a27]/10 text-[#2d5a27] flex items-center justify-center">
            <LoaderCircle className="w-7 h-7 animate-spin" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#2a1b12]">카카오 계정 연동 확인 중</h1>
            <p className="text-sm text-[#6a5632]">이미 가입된 이메일을 확인했어요.</p>
          </div>
        </div>
        <KakaoLinkConfirmDialog
          email={linkDraft.profile.email}
          isPending={isLinkPending}
          onCancel={handleKakaoLinkCancel}
          onConfirm={handleKakaoLinkConfirm}
        />
      </div>
    )
  }

  if (restoreDraft) {
    return (
      <div className="min-h-screen bg-[#f6f0da] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[2rem] border-4 border-[#2a1b12] bg-[#f0e6c0] shadow-[0_20px_60px_rgba(0,0,0,0.28)] p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#2d5a27]/10 text-[#2d5a27] flex items-center justify-center">
            <LoaderCircle className="w-7 h-7 animate-spin" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#2a1b12]">카카오 로그인 확인 중</h1>
            <p className="text-sm text-[#6a5632]">계정 상태를 확인하고 있어요.</p>
          </div>
        </div>
        <KakaoRestoreConfirmDialog
          password={restorePassword}
          passwordError={restorePasswordError}
          passwordRequired={restoreDraft.passwordRequired}
          isPending={isRestorePending}
          onCancel={handleKakaoRestoreCancel}
          onConfirm={handleKakaoRestoreConfirm}
          onPasswordChange={value => {
            setRestorePassword(value)
            setRestorePasswordError('')
          }}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f0da] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[2rem] border-4 border-[#2a1b12] bg-[#f0e6c0] shadow-[0_20px_60px_rgba(0,0,0,0.28)] p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#8b3a2a]/10 text-[#8b3a2a] flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#2a1b12]">카카오 로그인 실패</h1>
            <p className="text-sm text-[#6a5632]">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(ROUTES.home, { replace: true })}
            className="w-full bg-[#2d5a27] text-[#f0e6c0] py-3 rounded-xl border border-[#b4dc8c]/40 font-bold"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f0da] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[2rem] border-4 border-[#2a1b12] bg-[#f0e6c0] shadow-[0_20px_60px_rgba(0,0,0,0.28)] p-8 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#2d5a27]/10 text-[#2d5a27] flex items-center justify-center">
          <LoaderCircle className="w-7 h-7 animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#2a1b12]">카카오 로그인 처리 중</h1>
          <p className="text-sm text-[#6a5632]">인증 정보를 확인하고 있어요. 잠시만 기다려주세요.</p>
        </div>
      </div>
    </div>
  )
}

function KakaoLinkConfirmDialog({
  email,
  isPending,
  onCancel,
  onConfirm,
}: {
  email: string
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <FeedbackDialog
      variant="info"
      title="카카오 계정 연동"
      message={`${email}로 가입된 계정이 있어요. 이 계정에 카카오 로그인을 연동할까요?`}
      cancelLabel="취소"
      confirmLabel={isPending ? '연동 중...' : '연동하기'}
      isPending={isPending}
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  )
}

function KakaoRestoreConfirmDialog({
  password,
  passwordError,
  passwordRequired,
  isPending,
  onCancel,
  onConfirm,
  onPasswordChange,
}: {
  password: string
  passwordError: string
  passwordRequired: boolean
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
  onPasswordChange: (value: string) => void
}) {
  return (
    <FeedbackDialog
      variant="info"
      title="계정 복구"
      message={(
        <>
          <p style={{ margin: 0 }}>
            기존에 가입한 이력이 있습니다. 복구를 진행할까요?
          </p>
        {passwordRequired && (
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#6b5638',
                }}
              >
              기존 계정 비밀번호
            </label>
            <input
              type="password"
              value={password}
              disabled={isPending}
              onChange={event => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#f7eccd',
                  border: '2px solid #a37548',
                  color: '#4a3b2a',
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                  outline: 'none',
                  opacity: isPending ? 0.6 : 1,
                  cursor: isPending ? 'not-allowed' : 'text',
                }}
            />
            {passwordError && (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#8c3a1f' }}>
                  {passwordError}
                </p>
            )}
          </div>
        )}
        </>
      )}
      cancelLabel="아니오"
      confirmLabel={isPending ? '복구 중...' : '예'}
      isPending={isPending}
      onClose={onCancel}
      onConfirm={onConfirm}
    />
  )
}
