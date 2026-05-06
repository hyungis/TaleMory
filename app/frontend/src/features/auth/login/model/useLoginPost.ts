import { useCallback, useState } from 'react'
import { postLogin } from '../api/postLogin'
import type { LoginRequest, LoginResponse } from '../types'

interface UseLoginPostResult {
  isPending: boolean
  login: (request: LoginRequest) => Promise<LoginResponse>
}

export function useLoginPost(): UseLoginPostResult {
  // 현재 프로젝트는 React Query provider 가 아직 없어서 이 feature 내부에서 최소 pending 상태만 관리한다.
  const [isPending, setIsPending] = useState(false)

  const login = useCallback(async (request: LoginRequest) => {
    setIsPending(true)

    try {
      return await postLogin(request)
    } finally {
      setIsPending(false)
    }
  }, [])

  return {
    isPending,
    login,
  }
}
