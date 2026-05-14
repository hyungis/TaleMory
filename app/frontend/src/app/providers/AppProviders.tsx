import { useEffect, useState, type PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { initializeAuthSession } from '../../features/auth'

function AuthSessionBootstrap() {
  useEffect(() => {
    // 앱이 처음 뜰 때 토큰 resolver / 401 핸들러를 연결하고,
    // localStorage 에 stale access token 이 남아있으면 silent refresh 를 한 번 돌려둔다.
    // (Promise 반환값은 동기 흐름에서 무시 — 시작하기 클릭 같은 인증 분기에서 별도로 await 한다.)
    void initializeAuthSession()
  }, [])

  return null
}

/**
 * 앱 전역 Provider 조합.
 *
 * - BrowserRouter — SPA 라우팅
 * - QueryClientProvider — React Query 서버 상태 캐시. features 하위의 모든 Query/Post 훅이 필요로 함
 * - AuthSessionBootstrap — localStorage 세션 복원 + shared/api 토큰 resolver 등록
 *
 * TODO(S14P31S210-76): ErrorBoundary / ThemeProvider (다크/라이트) 추후 추가.
 */
export function AppProviders({ children }: PropsWithChildren) {
  // QueryClient 는 앱 생애주기 동안 단 한 번만 생성 — state 로 묶어 hot-reload 때 재생성 방지.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 기본 staleTime 은 0 이라 포커스 이동마다 refetch 됨. 개발 중 쾌적성 위해 1분.
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthSessionBootstrap />
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  )
}
