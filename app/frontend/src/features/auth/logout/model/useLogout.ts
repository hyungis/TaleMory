import { useCallback, useState } from 'react'
import { ROUTES } from '../../../../shared/constants'
import { clearAuthSession, useAuthSession } from '../../model/authSession'
import { postLogout } from '../api/postLogout'

export interface UseLogoutResult {
  isPending: boolean
  logout: () => Promise<void>
}

export function useLogout(): UseLogoutResult {
  const { isAuthenticated } = useAuthSession()
  const [isPending, setIsPending] = useState(false)

  const logout = useCallback(async () => {
    if (isPending) {
      return
    }

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
      window.alert('로그아웃되었습니다.')
      // hard reload 로 React Query 캐시 / 메모리 state / 잔여 인증 상태까지 깔끔히 리셋.
      // 라우트가 split 된 후라 SPA navigate 도 동작하지만, hard reload 가 가장 안전.
      window.location.assign(ROUTES.home)
    } finally {
      setIsPending(false)
    }
  }, [isAuthenticated, isPending])

  return { isPending, logout }
}
