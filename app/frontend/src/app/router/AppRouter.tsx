import { Route, Routes } from 'react-router-dom'
import { HomePage } from '../../pages/home'
import { MainPage } from '../../pages/main'
import { CreationPage } from '../../pages/creation'
import { ROUTES } from '../../shared/constants'

/**
 * 앱 라우팅 루트.
 *
 * 현재 라우트:
 * - /         → HomePage (랜딩)
 * - /main     → MainPage (숲/서점 씬)
 * - /creation → CreationPage (제작 워크스페이스, step 1~8 내부 state)
 *
 * Task 9+ 에서 viewer, mypage 추가 예정.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<HomePage />} />
      <Route path={ROUTES.main} element={<MainPage />} />
      <Route path={ROUTES.creation} element={<CreationPage />} />
      {/* TODO(S14P31S210-76): viewer, mypage */}
    </Routes>
  )
}
