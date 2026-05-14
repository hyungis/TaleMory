import { patch } from '../../../shared/api'

export function completeOnboarding(): Promise<void> {
  return patch<void>('/me/onboarding-completion')
}
