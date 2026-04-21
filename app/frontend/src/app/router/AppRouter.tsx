import { Route, Routes } from 'react-router-dom'
import { HomePage } from '../../pages/home'
import { MainPage } from '../../pages/main'
import { ROUTES } from '../../shared/constants'

/**
 * 앱 라우팅 루트.
 *
 * 현재 라우트:
 * - /     → HomePage (랜딩)
 * - /main → MainPage (숲 씬)
 *
 * Task 2+ 에서 bookshelf / creation / viewer / mypage 를 AppLayout 중첩 라우트로 추가.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<HomePage />} />
      <Route path={ROUTES.main} element={<MainPage />} />
      {/* TODO(S14P31S210-76): AppLayout 기반 중첩 라우트 */}
      {/* <Route element={<AppLayout />}>
        <Route path="/bookshelf" element={<BookshelfPage />} />
        <Route path="/creation" element={<CreationPage />} />
        <Route path="/viewer/:storyId" element={<ViewerPage />} />
        <Route path="/mypage" element={<MyPage />} />
      </Route> */}
    </Routes>
  )
}
