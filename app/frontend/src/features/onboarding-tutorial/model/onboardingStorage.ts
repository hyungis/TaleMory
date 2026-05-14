import type { AuthUser } from '../../../entities'

const ONBOARDING_SESSION_PROMPT_PREFIX = 'talemory.onboarding.prompted'

function getSessionPromptKey(user: AuthUser): string {
  return `${ONBOARDING_SESSION_PROMPT_PREFIX}.${user.id}`
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
