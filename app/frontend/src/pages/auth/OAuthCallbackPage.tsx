import { OAuthCallbackHandler } from '../../features/auth/oauth'

/**
 * OAuth 콜백 라우트는 feature 내부 처리기를 그대로 렌더하는 얇은 페이지로 유지한다.
 */
export function OAuthCallbackPage() {
  return <OAuthCallbackHandler />
}
