import { post } from '../../../../shared/api'
import { mapLoginResponse, type LoginResponse, type LoginResponsePayload } from '../../login'
import type { KakaoSignupRequest } from '../types'

export async function postKakaoSignup(body: KakaoSignupRequest): Promise<LoginResponse> {
  const payload = await post<LoginResponsePayload>(
    '/auth/kakao/signup',
    {
      signupToken: body.signupToken,
      email: body.email,
      name: body.name,
      nickname: body.nickname,
      phone: body.phone,
      agreeSms: body.agreeSms,
      agreeMarketing: body.agreeMarketing,
      restoreConfirmed: body.restoreConfirmed ?? false,
    },
    {
      skipAuth: true,
      timeoutMs: 10000,
    },
  )

  return mapLoginResponse(payload)
}
