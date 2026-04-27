import type { OauthProvider } from '../../../../entities/user'
import { ROUTES } from '../../../../shared/constants'

const KAKAO_LOGOUT_URL = 'https://kauth.kakao.com/oauth/logout'
const KAKAO_CLIENT_ID = import.meta.env.VITE_KAKAO_CLIENT_ID ?? ''

export function buildOauthLogoutUrl(provider: OauthProvider | null | undefined, origin: string): string | null {
  if (provider !== 'kakao' || KAKAO_CLIENT_ID === '') {
    return null
  }

  const logoutUrl = new URL(KAKAO_LOGOUT_URL)
  logoutUrl.searchParams.set('client_id', KAKAO_CLIENT_ID)
  logoutUrl.searchParams.set('logout_redirect_uri', `${origin}${ROUTES.logoutCallback}`)

  return logoutUrl.toString()
}
