import { createContext, useContext } from 'react'

export interface OnboardingTutorialContextValue {
  openTutorialPrompt: () => void
  isTutorialActive: boolean
}

export const OnboardingTutorialContext = createContext<OnboardingTutorialContextValue | null>(null)

export function useOnboardingTutorial() {
  const value = useContext(OnboardingTutorialContext)
  return value ?? { openTutorialPrompt: () => {}, isTutorialActive: false }
}
