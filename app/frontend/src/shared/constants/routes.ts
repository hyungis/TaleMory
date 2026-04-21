/**
 * 앱 라우트 경로 상수. 모든 <Link> / navigate() 호출 시 이 맵을 경유.
 */
export const ROUTES = {
  home: '/',
  main: '/main',
  creation: '/creation',
  // TODO(S14P31S210-76): 후속 Task 에서 추가
  // viewer: '/viewer/:storyId',
  // mypage: '/mypage',
  // oauthCallback: '/auth/oauth/callback',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]
