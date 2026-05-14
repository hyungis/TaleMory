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
          /main/* 는 RequireAuth 로 감싸되 MainShell 은 공통이라 ForestScene continuity 보존. */}
      <Route element={<MainShell />}>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route element={<RequireAuth />}>
          <Route path={`${ROUTES.main}/*`} element={null} />
        </Route>
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
