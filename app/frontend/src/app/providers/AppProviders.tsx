import { useEffect, type PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { initializeAuthSession } from '../../features/auth'

function AuthSessionBootstrap() {
  useEffect(() => {
    // 앱이 처음 뜰 때 localStorage 의 세션과 shared/api 의 토큰 resolver 를 다시 연결한다.
    initializeAuthSession()
  }, [])

  return null
}

/**
 * 앱 전역 Provider 조합.
 *
 * 현재는 BrowserRouter 와 인증 세션 bootstrap 만 포함. 이후 추가 예정:
 * - TODO(S14P31S210-76): QueryClientProvider (React Query — 서버 상태)
 * - TODO(S14P31S210-76): ErrorBoundary
 * - TODO(S14P31S210-76): ThemeProvider (다크/라이트)
 */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <BrowserRouter>
      <AuthSessionBootstrap />
      {children}
    </BrowserRouter>
  )
}
