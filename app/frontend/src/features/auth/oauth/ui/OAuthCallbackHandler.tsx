import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import { isApiError, post } from '../../../../shared/api'
import { ROUTES } from '../../../../shared/constants'
import { mapLoginResponse, type LoginResponsePayload } from '../../login'
import { clearAuthSession, setAuthSession } from '../../model/authSession'
import { parseOauthCallbackPayload } from '../lib/parseOauthCallbackPayload'

export function OAuthCallbackHandler() {
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

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

      void post<LoginResponsePayload>(
        '/auth/kakao/callback',
        {
          code: kakaoCode,
          redirectUri,
        },
        {
          skipAuth: true,
          timeoutMs: 10000,
        },
      )
        .then(payload => {
          if (!isActive) return
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
