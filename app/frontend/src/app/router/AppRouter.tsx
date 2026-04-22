import { Route, Routes } from 'react-router-dom'
import { HomePage } from '../../pages/home'
import { ROUTES } from '../../shared/constants'

/**
 * 앱 라우팅 루트.
 *
 * 현재는 랜딩(/) 단일 라우트. 로그인 후 페이지들은 AppLayout 아래 중첩 라우트로
 * S14P31S210-76 에서 확장 예정.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<HomePage />} />
      {/* TODO(S14P31S210-76): AppLayout 기반 중첩 라우트 */}
      {/* <Route element={<AppLayout />}>
        <Route path="/main" element={<MainPage />} />
        <Route path="/bookshelf" element={<BookshelfPage />} />
        ...
      </Route> */}
    </Routes>
  )
}
