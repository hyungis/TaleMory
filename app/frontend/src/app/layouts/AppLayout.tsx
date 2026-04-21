import { Outlet } from 'react-router-dom'
import { Header, Navigation } from '../../shared/ui'

/**
 * 로그인 후 페이지(main / bookshelf / viewer / mypage)의 공통 레이아웃.
 *
 * 랜딩(/) 은 no-chrome 전체 뷰포트 연출이 필요해 이 레이아웃을 쓰지 않는다.
 * 현재는 실제 자식 라우트가 없어 라우터에 연결되어 있지 않지만,
 * S14P31S210-76 에서 AppRouter 에 중첩 <Route element={<AppLayout />}> 로 편입 예정.
 */
export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a1a0a] text-[#f0e6c0]">
      <Header />
      <Navigation />
      <main className="flex-1 relative">
        <Outlet />
      </main>
    </div>
  )
}
