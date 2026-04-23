import type { AuthUser, OauthProvider } from '../../../entities'

export interface LoginRequest {
  loginId: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  user: AuthUser
}

export interface LoginResponsePayload {
  accessToken: string
  user: {
    id?: number
    userId?: number
    loginId?: string | null
    email?: string
    name?: string
    nickname?: string
    phone?: string | null
    agreeSms?: boolean
    agreeMarketing?: boolean
    provider?: OauthProvider | null
    createdAt?: string
    updatedAt?: string
  }
}
