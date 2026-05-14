import { post } from '../../../../shared/api'

interface EmailVerificationSendResponse {
  expiresInSeconds: number
}

interface EmailVerificationVerifyResponse {
  verified: boolean
}

export function postEmailVerificationSend(email: string): Promise<EmailVerificationSendResponse> {
  return post<EmailVerificationSendResponse>(
    '/auth/email-verification/send',
    { email },
    {
      skipAuth: true,
      timeoutMs: 10000,
    },
  )
}

export function postEmailVerificationVerify(
  email: string,
  code: string,
): Promise<EmailVerificationVerifyResponse> {
  return post<EmailVerificationVerifyResponse>(
    '/auth/email-verification/verify',
    { email, code },
    {
      skipAuth: true,
      timeoutMs: 5000,
    },
  )
}
