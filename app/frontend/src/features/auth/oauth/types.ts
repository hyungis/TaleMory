import type { LoginResponsePayload } from '../login'

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
  agreeSms: boolean
  agreeMarketing: boolean
}

export interface KakaoLoginCallbackPayload extends LoginResponsePayload {
  status: 'LOGIN'
}

export interface KakaoSignupRequiredCallbackPayload {
  status: 'SIGNUP_REQUIRED'
  signupToken: string
  profile: KakaoSignupProfile
}

export type KakaoCallbackResponsePayload = KakaoLoginCallbackPayload | KakaoSignupRequiredCallbackPayload
