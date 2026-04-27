import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../../../../shared/constants'
import { clearAuthSession, useAuthSession } from '../../model/authSession'
import { postLogout } from '../api/postLogout'

export interface UseLogoutResult {
  isPending: boolean
  logout: () => Promise<void>
}

export function useLogout(): UseLogoutResult {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthSession()
  const [isPending, setIsPending] = useState(false)

  const logout = useCallback(async () => {
    if (isPending) return

    setIsPending(true)

    try {
      // BE 세션 정리는 best-effort. 네트워크 실패 / BE 500 / 토큰 만료 등으로
      // 실패해도 FE 측 세션은 무조건 정리하고 랜딩으로 보낸다.
      // (사용자가 "로그아웃" 을 눌렀다는 의도가 BE 응답 실패보다 우선.)
      if (isAuthenticated) {
        try {
          await postLogout()
        } catch {
          // 의도적으로 swallow — 로컬 정리는 아래에서 계속.
        }
      }
      clearAuthSession()
      // `/` (HomePage 랜딩) 와 `/main` (MainPage) 가 라우트로 분리되어 있어
      // SPA navigate 만으로 충분하다. (이전엔 동일 라우트 quirk 회피용 hard reload 가
      // 필요했으나, 라우트 split 후엔 React Router 가 정상적으로 페이지를 교체한다.)
      navigate(ROUTES.home, { replace: true })
    } finally {
      setIsPending(false)
    }
  }, [isAuthenticated, isPending, navigate])

  return {
    isPending,
    logout,
  }
}
