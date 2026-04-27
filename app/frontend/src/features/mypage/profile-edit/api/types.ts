import type { OauthProvider, UserProfile } from '../../../../entities/user'

export interface MeResponse {
  id?: number
  userId?: number
  loginId?: string | null
  email?: string
  name?: string
  nickname?: string
  phone?: string | null
  agreeSms?: boolean
  agreeMarketing?: boolean
  provider?: string | OauthProvider | null
  createdAt?: string
  updatedAt?: string
}

export interface UpdateMeRequest {
  name: string
  nickname: string
  phone: string | null
  agreeSms: boolean
  agreeMarketing: boolean
}

const VALID_OAUTH_PROVIDERS: readonly OauthProvider[] = ['kakao', 'google', 'naver']

export function mapUserProfile(payload: MeResponse): UserProfile {
  return {
    id: getUserId(payload),
    loginId: typeof payload.loginId === 'string' ? payload.loginId : '',
    email: typeof payload.email === 'string' ? payload.email : '',
    name: typeof payload.name === 'string' ? payload.name : '',
    nickname: typeof payload.nickname === 'string' ? payload.nickname : '',
    phone: typeof payload.phone === 'string' ? payload.phone : null,
    agreeSms: payload.agreeSms === true,
    agreeMarketing: payload.agreeMarketing === true,
    provider: normalizeProvider(payload.provider),
    createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : '',
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : '',
  }
}

function getUserId(payload: MeResponse): number {
  if (typeof payload.userId === 'number') return payload.userId
  if (typeof payload.id === 'number') return payload.id
  return 0
}

function normalizeProvider(value: unknown): OauthProvider | null {
  if (typeof value !== 'string') return null
  return VALID_OAUTH_PROVIDERS.includes(value as OauthProvider) ? (value as OauthProvider) : null
}
