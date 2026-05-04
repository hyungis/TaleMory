import { post } from '../../../../shared/api'
import type { SignupRequest, SignupResponse } from '../types'

export async function postSignup(body: SignupRequest): Promise<SignupResponse> {
  return post<SignupResponse>(
    '/auth/signup',
    {
      loginId: body.loginId,
      password: body.password,
      passwordCheck: body.passwordCheck,
      email: body.email,
      name: body.name,
      nickname: body.nickname,
      phone: body.phone,
      termAgreements: body.termAgreements,
      restoreConfirmed: body.restoreConfirmed ?? false,
    },
    {
      // 회원가입 전 요청이므로 기존 Authorization 주입을 건너뛴다.
      skipAuth: true,
      timeoutMs: 10000,
    },
  )
}
