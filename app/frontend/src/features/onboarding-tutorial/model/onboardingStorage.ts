import type { AuthUser } from '../../../entities'

const ONBOARDING_STATUS_PREFIX = 'talemory.onboarding.status'
const ONBOARDING_SESSION_PROMPT_PREFIX = 'talemory.onboarding.prompted'

export type OnboardingStatus = 'completed'

function getStatusKey(user: AuthUser): string {
  return `${ONBOARDING_STATUS_PREFIX}.${user.id}`
}

function getSessionPromptKey(user: AuthUser): string {
  return `${ONBOARDING_SESSION_PROMPT_PREFIX}.${user.id}`
}

export function readOnboardingStatus(user: AuthUser | null): OnboardingStatus | null {
  if (typeof window === 'undefined' || user === null) return null

  try {
    const value = window.localStorage.getItem(getStatusKey(user))
    return value === 'completed' ? value : null
  } catch {
    return null
  }
}

export function writeOnboardingStatus(user: AuthUser | null, status: OnboardingStatus): void {
  if (typeof window === 'undefined' || user === null) return

  try {
    window.localStorage.setItem(getStatusKey(user), status)
  } catch {
    /* Tutorial is optional; storage failures should not block the app. */
  }
}

export function hasSeenOnboardingPromptThisSession(user: AuthUser | null): boolean {
  if (typeof window === 'undefined' || user === null) return false

  try {
    return window.sessionStorage.getItem(getSessionPromptKey(user)) === 'true'
  } catch {
    return false
  }
}

export function markOnboardingPromptSeenThisSession(user: AuthUser | null): void {
  if (typeof window === 'undefined' || user === null) return

  try {
    window.sessionStorage.setItem(getSessionPromptKey(user), 'true')
  } catch {
    /* Tutorial is optional; storage failures should not block the app. */
  }
}
