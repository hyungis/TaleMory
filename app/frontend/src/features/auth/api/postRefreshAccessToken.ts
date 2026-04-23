import { post } from '../../../shared/api'

interface RefreshAccessTokenResponse {
  accessToken: string
}

function isRefreshAccessTokenResponse(value: unknown): value is RefreshAccessTokenResponse {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<RefreshAccessTokenResponse>
  return typeof candidate.accessToken === 'string' && candidate.accessToken.length > 0
}

export async function postRefreshAccessToken(): Promise<string> {
  const payload = await post<RefreshAccessTokenResponse>('/auth/refresh', undefined, {
    // refresh token 은 HttpOnly 쿠키로 전달되므로 Authorization 헤더 없이 호출한다.
    skipAuth: true,
    timeoutMs: 10000,
    meta: {
      isAuthRefreshRequest: true,
    },
  })

  if (!isRefreshAccessTokenResponse(payload)) {
    throw new Error('토큰 재발급 응답에 access token 이 없습니다.')
  }

  return payload.accessToken
}
