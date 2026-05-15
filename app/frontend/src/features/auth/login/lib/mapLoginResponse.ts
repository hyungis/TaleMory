import type { AuthUser, OauthProvider } from '../../../../entities'
import type { LoginResponse, LoginResponsePayload } from '../types'

const VALID_OAUTH_PROVIDERS: readonly OauthProvider[] = ['kakao', 'google', 'naver']

export function mapLoginResponse(payload: LoginResponsePayload): LoginResponse {
  // 토큰이 없으면 이후 인증 요청이 전부 깨지므로 여기서 바로 실패시킨다.
  if (!isNonEmptyString(payload.accessToken)) {
    throw new Error('로그인 응답에 토큰 정보가 없습니다.')
  }

  return {
    accessToken: payload.accessToken,
    user: mapAuthUser(payload.user),
  }
}

function mapAuthUser(rawUser: LoginResponsePayload['user']): AuthUser {
  // 백엔드 구현과 문서가 조금 달라도 프론트에서 일관된 AuthUser 형태만 쓰도록 한 번 정규화한다.
  return {
    id: getUserId(rawUser),
    loginId: normalizeString(rawUser.loginId),
    email: normalizeString(rawUser.email),
    name: normalizeString(rawUser.name),
    nickname: normalizeString(rawUser.nickname),
    phone: typeof rawUser.phone === 'string' ? rawUser.phone : null,
    agreePrivacy: rawUser.agreePrivacy === true,
    agreeServiceTerms: rawUser.agreeServiceTerms === true,
    onboardingCompleted: rawUser.onboardingCompleted === true,
    provider: normalizeProvider(rawUser.provider),
    createdAt: normalizeString(rawUser.createdAt),
    updatedAt: normalizeString(rawUser.updatedAt),
  }
}

function getUserId(rawUser: LoginResponsePayload['user']): number {
  // 명세서에는 userId, 현재 백엔드 엔티티 직렬화 결과는 id 일 수 있어 둘 다 허용한다.
  if (typeof rawUser.id === 'number') return rawUser.id
  if (typeof rawUser.userId === 'number') return rawUser.userId
  return 0
}

function normalizeProvider(provider: unknown): OauthProvider | null {
  if (typeof provider !== 'string') return null
  return VALID_OAUTH_PROVIDERS.includes(provider as OauthProvider) ? (provider as OauthProvider) : null
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
