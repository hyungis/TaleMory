import type { PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router-dom'

/**
 * 앱 전역 Provider 조합.
 *
 * 현재는 BrowserRouter 만 포함. 이후 추가 예정:
 * - TODO(S14P31S210-76): QueryClientProvider (React Query — 서버 상태)
 * - TODO(S14P31S210-76): ErrorBoundary
 * - TODO(S14P31S210-76): ThemeProvider (다크/라이트)
 */
export function AppProviders({ children }: PropsWithChildren) {
  return <BrowserRouter>{children}</BrowserRouter>
}
