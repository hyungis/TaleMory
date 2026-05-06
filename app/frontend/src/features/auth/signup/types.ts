import type { TermAgreement } from '../terms'

export interface SignupRequest {
  loginId: string
  password: string
  passwordCheck: string
  email: string
  name: string
  nickname: string
  phone?: string
  termAgreements: TermAgreement[]
  restoreConfirmed?: boolean
}

export interface SignupResponse {
  userId: number
}
