import { Route, Routes } from 'react-router-dom'
import { LogoutCallbackPage, OAuthCallbackPage } from '../../pages/auth'
import { HomePage } from '../../pages/home'
import { MainShell } from '../../pages/main'
import { CreationPage } from '../../pages/creation'
import { ViewerPage, SharedViewerPage } from '../../pages/viewer'
import { MypagePage, VoiceCloneAddPage } from '../../pages/mypage'
import { AboutPage } from '../../pages/about'
import { ROUTES } from '../../shared/constants'
import { RequireAuth } from './RequireAuth'

/** 앱 라우팅 루트. */
export function AppRouter() {
  return (
    <Routes>
      {/* MainShell 이 / 와 /main/* 양쪽에서 같은 MainPage 인스턴스를 유지.
          → 랜딩(/) → /main 전환 시 ForestScene 이 unmount 되지 않아 자연스러움.
          /main/* 의 인증 가드는 MainShell 안에서 직접 처리한다 — RequireAuth 를 Outlet 으로
          쓰면 MainPage 가 이미 마운트되어 BookstoreScene 쿼리가 발사되는 race 가 발생함. */}
      <Route element={<MainShell />}>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={`${ROUTES.main}/*`} element={null} />
      </Route>

      {/* 인증 필수 — 비로그인 진입 시 / 로 replace. */}
      <Route element={<RequireAuth />}>
        <Route path={ROUTES.creation} element={<CreationPage />} />
        <Route path={ROUTES.viewer} element={<ViewerPage />} />
        <Route path={ROUTES.mypage} element={<MypagePage />} />
        <Route path={ROUTES.mypageVoiceClone} element={<VoiceCloneAddPage />} />
      </Route>

      {/* 공용 — 비로그인 상태에서도 접근 가능. */}
      <Route path={ROUTES.shared} element={<SharedViewerPage />} />
      <Route path={ROUTES.kakaoCallback} element={<OAuthCallbackPage />} />
      <Route path={ROUTES.oauthCallback} element={<OAuthCallbackPage />} />
      <Route path={ROUTES.logoutCallback} element={<LogoutCallbackPage />} />
      <Route path={ROUTES.about} element={<AboutPage />} />
    </Routes>
  )
}
