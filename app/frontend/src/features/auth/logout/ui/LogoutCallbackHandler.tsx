import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import { ROUTES } from '../../../../shared/constants'
import { clearAuthSession } from '../../model/authSession'
import { parseLogoutCallbackResult } from '../lib/parseLogoutCallbackResult'

export function LogoutCallbackHandler() {
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const callbackResult = useMemo(
    () => parseLogoutCallbackResult(location.hash, location.search),
    [location.hash, location.search],
  )

  useEffect(() => {
    if (callbackResult.error) {
      setError(callbackResult.error)
      return
    }

    clearAuthSession()
    // 로그아웃 후엔 랜딩 영상 + "시작하기" 가 있는 첫 페이지(`/` HomePage) 로 이동.
    navigate(ROUTES.home, { replace: true })
  }, [callbackResult.error, navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f0da] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[2rem] border-4 border-[#2a1b12] bg-[#f0e6c0] shadow-[0_20px_60px_rgba(0,0,0,0.28)] p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#8b3a2a]/10 text-[#8b3a2a] flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#2a1b12]">로그아웃 오류</h1>
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

  const providerLabel = callbackResult.provider === 'kakao' ? '카카오' : '서비스'

  return (
    <div className="min-h-screen bg-[#f6f0da] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[2rem] border-4 border-[#2a1b12] bg-[#f0e6c0] shadow-[0_20px_60px_rgba(0,0,0,0.28)] p-8 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#2d5a27]/10 text-[#2d5a27] flex items-center justify-center">
          <LoaderCircle className="w-7 h-7 animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#2a1b12]">{providerLabel} 로그아웃 중</h1>
          <p className="text-sm text-[#6a5632]">안전하게 로그아웃 정보를 정리하고 있습니다.</p>
        </div>
      </div>
    </div>
  )
}
