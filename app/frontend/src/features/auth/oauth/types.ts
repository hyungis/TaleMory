import type { LoginResponsePayload } from '../login'
import type { TermAgreement } from '../terms'

export interface KakaoCallbackRequest {
  code: string
  redirectUri: string
}

export interface KakaoSignupProfile {
  email: string
  name: string
  nickname: string
  phone?: string | null
}

export interface KakaoSignupRequest {
  signupToken: string
  email: string
  name: string
  nickname: string
  phone?: string
  termAgreements?: TermAgreement[]
  restoreConfirmed?: boolean
  linkConfirmed?: boolean
}

export interface KakaoLoginCallbackPayload extends LoginResponsePayload {
  status: 'LOGIN'
}

export interface KakaoSignupRequiredCallbackPayload {
  status: 'SIGNUP_REQUIRED'
  signupToken: string
  profile: KakaoSignupProfile
}

export interface KakaoRestoreRequiredCallbackPayload {
  status: 'RESTORE_REQUIRED'
  signupToken: string
  profile: KakaoSignupProfile
}

export interface KakaoLinkRequiredCallbackPayload {
  status: 'LINK_REQUIRED'
  signupToken: string
  profile: KakaoSignupProfile
}

export type KakaoCallbackResponsePayload =
  | KakaoLoginCallbackPayload
  | KakaoSignupRequiredCallbackPayload
  | KakaoRestoreRequiredCallbackPayload
  | KakaoLinkRequiredCallbackPayload
