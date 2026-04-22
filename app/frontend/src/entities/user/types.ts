/**
 * 사용자 도메인 타입 스텁. 백엔드 `users` / `oauth_accounts` 테이블 기반으로 이후 확장.
 */

export type OauthProvider = 'kakao' | 'google' | 'naver'

export interface AuthUser {
  id: number
  loginId: string
  email: string
  nickname: string
  phone?: string
}

export interface OauthAccount {
  provider: OauthProvider
  providerUserId: string
}

export interface UserProfile extends AuthUser {
  agreeSms: boolean
  agreeMarketing: boolean
  oauthAccounts: OauthAccount[]
}
