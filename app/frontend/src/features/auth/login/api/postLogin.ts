import { post } from '../../../../shared/api'
import { mapLoginResponse } from '../lib/mapLoginResponse'
import type { LoginRequest, LoginResponse, LoginResponsePayload } from '../types'

export async function postLogin(body: LoginRequest): Promise<LoginResponse> {
  // shared/api 의 base URL 이 이미 `/api` 이므로 여기서는 도메인 내부 경로만 넘긴다.
  const payload = await post<LoginResponsePayload>(
    '/auth/login',
    {
      loginId: body.loginId,
      password: body.password,
    },
    {
      // 로그인 전 요청이므로 기존 Authorization 주입을 건너뛴다.
      skipAuth: true,
      timeoutMs: 10000,
    },
  )

  return mapLoginResponse(payload)
}
