import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { ROUTES } from '../../../../shared/constants'
import { FeedbackDialog } from '../../../../shared/ui'
import { clearAuthSession } from '../../model/authSession'
import { parseLogoutCallbackResult } from '../lib/parseLogoutCallbackResult'

export function LogoutCallbackHandler() {
  const location = useLocation()
  const navigate = useNavigate()
  const handledRef = useRef(false)

  const callbackResult = useMemo(
    () => parseLogoutCallbackResult(location.hash, location.search),
    [location.hash, location.search],
  )

  useEffect(() => {
    if (handledRef.current) {
      return
    }

    if (callbackResult.error) {
      handledRef.current = true
      return
    }

    handledRef.current = true
    clearAuthSession()
  }, [callbackResult.error])

  const handleSuccessDialogClose = () => {
    // 로그아웃 후엔 랜딩 영상 + "시작하기" 가 있는 첫 페이지(`/` HomePage) 로 이동.
    navigate(ROUTES.home, { replace: true })
  }

  if (callbackResult.error) {
    return (
      <div className="min-h-screen bg-[#f6f0da] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-[2rem] border-4 border-[#2a1b12] bg-[#f0e6c0] shadow-[0_20px_60px_rgba(0,0,0,0.28)] p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#8b3a2a]/10 text-[#8b3a2a] flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#2a1b12]">로그아웃 오류</h1>
            <p className="text-sm text-[#6a5632]">{callbackResult.error}</p>
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
    <FeedbackDialog
      variant="success"
      title="로그아웃 완료"
      message="로그아웃되었습니다."
      onClose={handleSuccessDialogClose}
    />
  )
}
