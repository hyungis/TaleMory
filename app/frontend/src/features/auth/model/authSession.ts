import { useSyncExternalStore } from 'react'
import type { AuthUser, OauthProvider } from '../../../entities'
import { setAccessTokenResolver, setUnauthorizedRetryHandler } from '../../../shared/api'
import { postRefreshAccessToken } from '../api/postRefreshAccessToken'

const AUTH_SESSION_STORAGE_KEY = 'talemory.auth.session'
const VALID_OAUTH_PROVIDERS: readonly OauthProvider[] = ['kakao', 'google', 'naver']

export interface AuthSessionPayload {
  accessToken: string
  user: AuthUser
}

export interface AuthSessionSnapshot {
  accessToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
}

// React Context/Zustand 없이도 인증 상태를 구독할 수 있도록 간단한 external store 형태로 유지한다.
const listeners = new Set<() => void>()

let resolverInitialized = false
let refreshRequest: Promise<boolean> | null = null
let bootstrapPromise: Promise<void> | null = null
// 새로고침 직후에도 로그인 상태가 이어지도록 모듈 초기화 시 localStorage 를 먼저 읽는다.
let authSessionSnapshot = readStoredAuthSession()

/**
 * 앱 부팅 시 한 번 호출되어 토큰 resolver / 401 핸들러를 등록한다.
 *
 * localStorage 에 세션이 남아있으면 곧장 silent refresh 를 시도해
 *  - 유효한 refresh cookie 가 있으면 fresh access token 으로 교체 (stale 토큰으로 인한 첫 API 401 회피)
 *  - refresh 도 실패하면 clearAuthSession() 으로 로그아웃 상태 정리
 *
 * 시작하기 버튼 / 책장 진입 등 인증 분기 이전에 await 하면 stale 한 isAuthenticated 로
 * UI 가 분기되는 race 를 막을 수 있다. 동일한 호출에 대해 캐시된 promise 를 반환한다.
 */
export function initializeAuthSession(): Promise<void> {
  if (bootstrapPromise !== null) return bootstrapPromise

  if (!resolverInitialized) {
    // shared/api 는 토큰 저장 위치를 모르기 때문에 "현재 access token 을 꺼내는 함수"만 연결해 둔다.
    setAccessTokenResolver(() => authSessionSnapshot.accessToken)
    // refresh token 은 JS 저장소에 두지 않고 HttpOnly 쿠키로만 다루므로, 401 복구는 auth feature가 맡는다.
    setUnauthorizedRetryHandler(refreshAccessToken)
    resolverInitialized = true
  }

  bootstrapPromise = bootstrapAuthSession()
  return bootstrapPromise
}

async function bootstrapAuthSession(): Promise<void> {
  // 저장된 세션이 없으면 추가 작업 불필요.
  if (!authSessionSnapshot.isAuthenticated) return

  // stale access token 일 가능성이 있으므로 부팅 시점에 한 번 refresh 를 강제로 돌려본다.
  // refreshAccessToken 은 성공 시 snapshot 을 갱신하고, 실패 시 내부에서 clearAuthSession() 을 호출한다.
  await refreshAccessToken()
}

export function useAuthSession(): AuthSessionSnapshot {
  return useSyncExternalStore(subscribe, getAuthSessionSnapshot, getAuthSessionSnapshot)
}

export function getAuthSessionSnapshot(): AuthSessionSnapshot {
  return authSessionSnapshot
}

export function setAuthSession(session: AuthSessionPayload): void {
  // initializeAuthSession 은 이제 Promise 를 반환하지만 setAuthSession 동기 흐름에선 결과 대기 불필요.
  // (boot refresh 가 끝나기 전에 로그인이 끝나면, refresh 결과는 logged-in user id 가 바뀌었으므로 무시됨.)
  void initializeAuthSession()
  authSessionSnapshot = createAuthenticatedSnapshot(session)
  persistAuthSession(authSessionSnapshot)
  emitChange()
}

export function clearAuthSession(): void {
  authSessionSnapshot = createEmptyAuthSession()
  persistAuthSession(authSessionSnapshot)
  emitChange()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function emitChange(): void {
  listeners.forEach(listener => listener())
}

function createAuthenticatedSnapshot(session: AuthSessionPayload): AuthSessionSnapshot {
  return {
    accessToken: session.accessToken,
    user: session.user,
    isAuthenticated: true,
  }
}

function createEmptyAuthSession(): AuthSessionSnapshot {
  return {
    accessToken: null,
    user: null,
    isAuthenticated: false,
  }
}

function readStoredAuthSession(): AuthSessionSnapshot {
  if (!isBrowser()) return createEmptyAuthSession()

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
    if (raw === null) return createEmptyAuthSession()

    const parsed = JSON.parse(raw) as unknown
    if (!isAuthSessionPayload(parsed)) {
      // 오래된 스키마나 깨진 값이 남아 있으면 다시 비로그인 상태로 정리한다.
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
      return createEmptyAuthSession()
    }

    return createAuthenticatedSnapshot(parsed)
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return createEmptyAuthSession()
  }
}

function persistAuthSession(snapshot: AuthSessionSnapshot): void {
  if (!isBrowser()) return

  if (!snapshot.isAuthenticated || snapshot.accessToken === null || snapshot.user === null) {
    // 로그아웃 또는 비로그인 상태에서는 저장된 인증 정보를 제거한다.
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return
  }

  const payload: AuthSessionPayload = {
    accessToken: snapshot.accessToken,
    user: snapshot.user,
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload))
}

function isAuthSessionPayload(value: unknown): value is AuthSessionPayload {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<AuthSessionPayload>

  // refresh token 은 더 이상 저장하지 않고, access token 과 사용자 정보만 복원한다.
  return typeof candidate.accessToken === 'string' && candidate.accessToken.length > 0 && isAuthUser(candidate.user)
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<AuthUser>

  // 로그인 응답을 저장했다가 복원하는 경로이므로, 화면에서 실제로 쓰는 사용자 필드만 확인한다.
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.loginId === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.nickname === 'string' &&
    (candidate.phone === undefined || candidate.phone === null || typeof candidate.phone === 'string') &&
    typeof candidate.agreeSms === 'boolean' &&
    typeof candidate.agreeMarketing === 'boolean' &&
    isOauthProvider(candidate.provider) &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  )
}

function isOauthProvider(value: unknown): value is OauthProvider | null {
  if (value === null) return true
  if (typeof value !== 'string') return false
  return VALID_OAUTH_PROVIDERS.includes(value as OauthProvider)
}

async function refreshAccessToken(): Promise<boolean> {
  if (!authSessionSnapshot.isAuthenticated || authSessionSnapshot.user === null) {
    return false
  }

  if (refreshRequest !== null) {
    return refreshRequest
  }

  const currentUserId = authSessionSnapshot.user.id

  refreshRequest = (async () => {
    try {
      const accessToken = await postRefreshAccessToken()

      // 중간에 로그아웃되었거나 다른 사용자 세션으로 바뀌었으면 덮어쓰지 않는다.
      if (!authSessionSnapshot.isAuthenticated || authSessionSnapshot.user?.id !== currentUserId) {
        return false
      }

      authSessionSnapshot = {
        ...authSessionSnapshot,
        accessToken,
        isAuthenticated: true,
      }
      persistAuthSession(authSessionSnapshot)
      emitChange()
      return true
    } catch {
      // refresh 도중 다른 사용자가 로그인했다면 (예: 부팅 refresh 가 실패하는 사이 OAuth 콜백이 setAuthSession 호출)
      // 새 세션은 그대로 두고 옛 세션만 정리한다. id 가 바뀌었거나 이미 로그아웃 상태면 굳이 다시 비울 필요 없음.
      if (authSessionSnapshot.isAuthenticated && authSessionSnapshot.user?.id === currentUserId) {
        clearAuthSession()
      }
      return false
    } finally {
      refreshRequest = null
    }
  })()

  return refreshRequest
}

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}
