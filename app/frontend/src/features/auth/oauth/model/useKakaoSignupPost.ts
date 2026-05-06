import { useCallback, useState } from 'react'
import type { LoginResponse } from '../../login'
import { postKakaoSignup } from '../api/postKakaoSignup'
import type { KakaoSignupRequest } from '../types'

interface UseKakaoSignupPostResult {
  isPending: boolean
  signup: (request: KakaoSignupRequest) => Promise<LoginResponse>
}

export function useKakaoSignupPost(): UseKakaoSignupPostResult {
  const [isPending, setIsPending] = useState(false)

  const signup = useCallback(async (request: KakaoSignupRequest) => {
    setIsPending(true)

    try {
      return await postKakaoSignup(request)
    } finally {
      setIsPending(false)
    }
  }, [])

  return {
    isPending,
    signup,
  }
}
