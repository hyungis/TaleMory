import { useSyncExternalStore } from 'react'
import type { AuthUser, OauthProvider } from '../../../entities'
import { setAccessTokenResolver } from '../../../shared/api'

const AUTH_SESSION_STORAGE_KEY = 'talemory.auth.session'
const VALID_OAUTH_PROVIDERS: readonly OauthProvider[] = ['kakao', 'google', 'naver']

export interface AuthSessionPayload {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export interface AuthSessionSnapshot {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
}

// React Context/Zustand 없이도 인증 상태를 구독할 수 있도록 간단한 external store 형태로 유지한다.
const listeners = new Set<() => void>()

let resolverInitialized = false
// 새로고침 직후에도 로그인 상태가 이어지도록 모듈 초기화 시 localStorage 를 먼저 읽는다.
let authSessionSnapshot = readStoredAuthSession()

export function initializeAuthSession(): void {
  if (resolverInitialized) return

  // shared/api 는 토큰 저장 위치를 모르기 때문에 "현재 access token 을 꺼내는 함수"만 연결해 둔다.
  setAccessTokenResolver(() => authSessionSnapshot.accessToken)
  resolverInitialized = true
}

export function useAuthSession(): AuthSessionSnapshot {
  return useSyncExternalStore(subscribe, getAuthSessionSnapshot, getAuthSessionSnapshot)
}

export function getAuthSessionSnapshot(): AuthSessionSnapshot {
  return authSessionSnapshot
}

export function setAuthSession(session: AuthSessionPayload): void {
  initializeAuthSession()
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
    refreshToken: session.refreshToken,
    user: session.user,
    isAuthenticated: true,
  }
}

function createEmptyAuthSession(): AuthSessionSnapshot {
  return {
    accessToken: null,
    refreshToken: null,
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

  if (
    !snapshot.isAuthenticated ||
    snapshot.accessToken === null ||
    snapshot.refreshToken === null ||
    snapshot.user === null
  ) {
    // 로그아웃 또는 비로그인 상태에서는 저장된 인증 정보를 제거한다.
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return
  }

  const payload: AuthSessionPayload = {
    accessToken: snapshot.accessToken,
    refreshToken: snapshot.refreshToken,
    user: snapshot.user,
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload))
}

function isAuthSessionPayload(value: unknown): value is AuthSessionPayload {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<AuthSessionPayload>

  // 저장된 세션을 다시 믿고 쓰기 전에 최소한의 필드 형태를 검증해 런타임 오류를 막는다.
  return (
    typeof candidate.accessToken === 'string' &&
    candidate.accessToken.length > 0 &&
    typeof candidate.refreshToken === 'string' &&
    candidate.refreshToken.length > 0 &&
    isAuthUser(candidate.user)
  )
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

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}
