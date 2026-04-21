/**
 * 앱 라우트 경로 상수. 모든 <Link> / navigate() 호출 시 이 맵을 경유.
 *
 * 후속 subtask(S14P31S210-76) 에서 main / bookshelf / viewer / mypage 추가 예정.
 * 현재는 랜딩(/) 단일 라우트.
 */
export const ROUTES = {
  home: '/',
  // TODO(S14P31S210-76): 추가 라우트
  // main: '/main',
  // bookshelf: '/bookshelf',
  // creation: '/creation',
  // viewer: '/viewer/:storyId',
  // mypage: '/mypage',
  // oauthCallback: '/auth/oauth/callback',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]
