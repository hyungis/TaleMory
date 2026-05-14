import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthBootstrapDone, useAuthSession } from '../../features/auth'
import { ROUTES } from '../../shared/constants'

/**
 * 인증 라우트 가드 — 자식 라우트를 `isAuthenticated === true` 일 때만 렌더한다.
 *
 * 인증되지 않은 상태로 진입(직접 URL 입력) 하거나,
 * 토큰 만료로 `refreshAccessToken` 이 실패해 `clearAuthSession()` 이 호출되면
 * `useAuthSession` 구독이 isAuthenticated=false 를 감지 → home(`/`) 으로 replace navigate.
 *
 * 보호 대상:
 *  - `/main/*`  (책장)
 *  - `/creation` (동화 생성 플로우)
 *  - `/viewer/:storyId` (본인 동화 뷰어 — 공유 링크 `/shared/:token` 은 별도 공용)
 *  - `/mypage`, `/mypage/voice-clone`
 *
 * 보호하지 않는 경로:
 *  - `/` `/about` — 비로그인 노출
 *  - `/auth/*` 콜백 — OAuth 진입 자체가 비로그인 상태에서 일어남
 *  - `/shared/:token` — 공유 토큰 기반 공개 뷰어
 *
 * BE `SecurityConfig` 도 동일한 엔드포인트를 `.authenticated()` 로 강제하므로
 * 이 가드는 UX 정리용 (FE 가 비로그인 페이지를 보여주지 않게) 이지 보안 게이트는 아니다.
 */
export function RequireAuth() {
  const { isAuthenticated } = useAuthSession()
  const bootstrapDone = useAuthBootstrapDone()
  const location = useLocation()

  // 부팅 refresh 가 끝나기 전엔 자식 라우트 마운트 보류 — corrupted/stale 토큰으로
  // 자식이 API 쿼리를 발사하기 전에 isAuthenticated 가 확정되도록 한다.
  if (!bootstrapDone) {
    return null
  }

  if (!isAuthenticated) {
    // 로그인 후 원래 가려던 경로로 돌아갈 수 있도록 location 을 state 로 넘긴다.
    // 현재는 HomePage 에서 활용 안 하지만 추후 deep-link 복귀 구현 시 사용 가능.
    return <Navigate to={ROUTES.home} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
