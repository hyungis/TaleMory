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
      if (!isAuthenticated) {
        clearAuthSession()
        navigate(ROUTES.home, { replace: true })
        return
      }

      await postLogout()
      clearAuthSession()
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
