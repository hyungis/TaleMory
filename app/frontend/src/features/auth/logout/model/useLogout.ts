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

    let navigated = false
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
      // 알람 → state 클리어 → navigate 순서가 중요.
      // alert 가 블로킹되는 동안엔 아직 isAuthenticated=true 라 "로그인 필요" 같은 분기가
      // 깜빡이지 않는다. 사용자가 OK 누른 직후 세션 정리 + 하드 리로드로 홈 이동.
      window.alert('로그아웃되었습니다.')
      clearAuthSession()
      // hard reload 로 React Query 캐시 / 메모리 state / 잔여 인증 상태까지 깔끔히 리셋.
      // replace 로 history 도 정리해 뒤로가기로 mypage 에 복귀하지 않도록.
      window.location.replace(ROUTES.home)
      navigated = true
    } finally {
      // navigation 을 성공적으로 트리거했다면 isPending 을 그대로 둔다.
      // 리셋하면 React 가 unauthenticated 상태로 한 프레임 리렌더해 "로그인 필요" 분기가
      // 깜빡인 뒤 브라우저가 navigation 을 commit 하는 race 가 발생함.
      if (!navigated) setIsPending(false)
    }
  }, [isAuthenticated, isPending])

  return { isPending, logout }
}
