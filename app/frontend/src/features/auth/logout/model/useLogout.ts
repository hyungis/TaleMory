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
      if (isAuthenticated) {
        await postLogout()
      }

      clearAuthSession()
      window.alert('로그아웃되었습니다.')
      window.location.assign(ROUTES.home)
    } finally {
      setIsPending(false)
    }
  }, [isAuthenticated, isPending])

  return { isPending, logout }
}
