/**
 * 앱 라우트 경로 상수. 모든 <Link> / navigate() 호출 시 이 맵을 경유.
 */
export const ROUTES = {
  home: '/',
  main: '/main',
  creation: '/creation',
  viewer: '/viewer/:storyId',
  mypage: '/mypage',
  mypageVoiceClone: '/mypage/voice-clone',
  // TODO: oauthCallback
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

/** viewer 경로 조립 헬퍼 (:storyId 치환). */
export function buildViewerPath(storyId: number | string): string {
  return `/viewer/${storyId}`
}
