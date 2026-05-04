import { useCallback, useState } from 'react'
import { postSignup } from '../api/postSignup'
import type { SignupRequest, SignupResponse } from '../types'

interface UseSignupPostResult {
  isPending: boolean
  signup: (request: SignupRequest) => Promise<SignupResponse>
}

export function useSignupPost(): UseSignupPostResult {
  // 현재 프로젝트는 React Query provider 가 아직 없어서 이 feature 내부에서 최소 pending 상태만 관리한다.
  const [isPending, setIsPending] = useState(false)

  const signup = useCallback(async (request: SignupRequest) => {
    setIsPending(true)

    try {
      return await postSignup(request)
    } finally {
      setIsPending(false)
    }
  }, [])

  return {
    isPending,
    signup,
  }
}
