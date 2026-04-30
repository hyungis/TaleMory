import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Info, LoaderCircle } from 'lucide-react'
import { isApiError } from '../../../../shared/api'
import { ROUTES } from '../../../../shared/constants'
import { mapLoginResponse, type LoginResponse } from '../../login'
import { clearAuthSession, setAuthSession } from '../../model/authSession'
import { postKakaoCallback } from '../api/postKakaoCallback'
import { parseOauthCallbackPayload } from '../lib/parseOauthCallbackPayload'
import type { KakaoSignupProfile } from '../types'
import { KakaoSignupForm } from './KakaoSignupForm'

interface KakaoSignupDraft {
  signupToken: string
  profile: KakaoSignupProfile
}

export function OAuthCallbackHandler() {
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [signupDraft, setSignupDraft] = useState<KakaoSignupDraft | null>(null)
  const [isSignupNoticeOpen, setIsSignupNoticeOpen] = useState(false)

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
            setSignupDraft({
              signupToken: payload.signupToken,
              profile: payload.profile,
            })
            setIsSignupNoticeOpen(true)
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

  const handleKakaoSignupSuccess = (result: LoginResponse) => {
    setAuthSession(result)
    navigate(ROUTES.home, {
      replace: true,
      state: {
        skipLanding: true,
      },
    })
  }

  const handleKakaoSignupCancel = () => {
    clearAuthSession()
    setIsSignupNoticeOpen(false)
    navigate(ROUTES.home, { replace: true })
  }

  if (signupDraft) {
    return (
      <>
        <KakaoSignupForm
          signupToken={signupDraft.signupToken}
          profile={signupDraft.profile}
          onSuccess={handleKakaoSignupSuccess}
          onCancel={handleKakaoSignupCancel}
        />
        {isSignupNoticeOpen && (
          <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="kakao-signup-notice-title"
              className="w-full max-w-sm rounded-[2rem] border-4 border-[#2a1b12] bg-[#f0e6c0] shadow-[0_20px_60px_rgba(0,0,0,0.45)] p-6 text-center space-y-5"
            >
              <div className="mx-auto w-14 h-14 rounded-full bg-[#2d5a27]/10 text-[#2d5a27] flex items-center justify-center">
                <Info className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h1 id="kakao-signup-notice-title" className="text-xl font-bold text-[#2a1b12]">
                  회원 정보 입력이 필요해요
                </h1>
                <p className="text-sm leading-6 text-[#6a5632]">
                  카카오 인증은 완료됐어요. 가입을 마치려면 서비스에서 사용할 회원 정보를 한 번 더 확인해주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSignupNoticeOpen(false)}
                className="w-full bg-[#2d5a27] text-[#f0e6c0] py-3 rounded-xl border border-[#b4dc8c]/40 font-bold shadow-[0_4px_0_#1a3a14] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14] transition-all"
              >
                확인
              </button>
            </div>
          </div>
        )}
      </>
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
