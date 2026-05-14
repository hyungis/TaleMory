import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthBootstrapDone, useAuthSession } from '../../features/auth'
import { ROUTES } from '../../shared/constants'
import { MainPage } from './MainPage'

/**
 * `/` 와 `/main/*` 를 묶는 레이아웃 루트.
 *
 * MainPage 를 항상 렌더하고, 하위 라우트에 해당하는 오버레이만 `<Outlet />` 으로 갈아끼운다:
 * - `/`               → HomePage (랜딩 영상 / 나비 디졸브 오버레이)
 * - `/main`           → null (오버레이 없음, MainPage 만 노출)
 * - `/main/bookshelf` → null (MainPage 자체가 모달을 띄움)
 *
 * 이 패턴으로 `/` → `/main` 전환 시 MainPage 가 unmount/remount 되지 않아 ForestScene 의
 * particles / 애니메이션 / phase state 가 끊기지 않고 부드럽게 이어진다.
 *
 * (이전 구조에서는 HomePage 가 자체적으로 MainPage 를 in-place 렌더하다가 navigate 시점에
 *  unmount → 라우트 전환 후 새로 mount 되며 ForestScene 이 리셋되는 stutter 가 발생했음.)
 *
 * 인증 가드:
 *   /main 이하 경로는 인증 필수.
 *   비로그인 상태로 진입하면 `<Outlet/>` 으로 RequireAuth 가 redirect 되기 전에 MainPage 가
 *   이미 마운트되며 BookstoreScene 의 stories 쿼리가 발사돼 500 에러가 콘솔에 쌓이는 문제가
 *   있어, MainPage 마운트 자체를 막기 위해 셸 진입점에서 직접 가드한다.
 *   `/` (랜딩) 은 비로그인도 접근 가능하므로 path 가 /main 으로 시작할 때만 적용.
 */
export function MainShell() {
  const { isAuthenticated } = useAuthSession()
  const bootstrapDone = useAuthBootstrapDone()
  const location = useLocation()

  const isProtectedPath = location.pathname.startsWith(ROUTES.main)

  // 부팅 refresh 가 끝나기 전에는 보호 경로에서 MainPage 마운트를 보류.
  // 그렇지 않으면 localStorage 의 corrupted/stale 토큰으로 BookstoreScene 가 마운트되며
  // /api/stories 등이 401 폭탄을 맞춘다.
  if (isProtectedPath && !bootstrapDone) {
    return null
  }

  if (isProtectedPath && !isAuthenticated) {
    return <Navigate to={ROUTES.home} replace state={{ from: location.pathname }} />
  }

  return (
    <>
      <MainPage />
      <Outlet />
    </>
  )
}
