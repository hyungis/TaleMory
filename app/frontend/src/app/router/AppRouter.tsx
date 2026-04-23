import { Route, Routes } from 'react-router-dom'
import { LogoutCallbackPage, OAuthCallbackPage } from '../../pages/auth'
import { HomePage } from '../../pages/home'
import { MainPage } from '../../pages/main'
import { CreationPage } from '../../pages/creation'
import { ViewerPage } from '../../pages/viewer'
import { ROUTES } from '../../shared/constants'

/** 앱 라우팅 루트. */
export function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<HomePage />} />
      <Route path={ROUTES.main} element={<MainPage />} />
      <Route path={ROUTES.creation} element={<CreationPage />} />
      <Route path={ROUTES.viewer} element={<ViewerPage />} />
      <Route path={ROUTES.oauthCallback} element={<OAuthCallbackPage />} />
      <Route path={ROUTES.logoutCallback} element={<LogoutCallbackPage />} />
      {/* TODO: mypage */}
    </Routes>
  )
}
