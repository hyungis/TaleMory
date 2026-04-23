import { post } from '../../../../shared/api'
import type { SignupRequest } from '../types'

export async function postSignup(body: SignupRequest): Promise<void> {
  await post<void>(
    '/auth/signup',
    {
      loginId: body.loginId,
      password: body.password,
      email: body.email,
      name: body.name,
      nickname: body.nickname,
      phone: body.phone,
      agreeSms: body.agreeSms,
      agreeMarketing: body.agreeMarketing,
    },
    {
      // 회원가입 전 요청이므로 기존 Authorization 주입을 건너뛴다.
      skipAuth: true,
      timeoutMs: 10000,
    },
  )
}
