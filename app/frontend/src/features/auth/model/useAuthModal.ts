import { useCallback, useState } from 'react'

export type AuthMode = 'login' | 'register'

export interface UseAuthModalResult {
  isOpen: boolean
  mode: AuthMode
  open: (mode?: AuthMode) => void
  close: () => void
  switchMode: (mode: AuthMode) => void
}

/**
 * Auth 모달 열림/닫힘 + tab(login/register) 상태 관리.
 * HomePage 등 상위 컴포넌트에서 호출 후 AuthModal 에 props 로 바인딩.
 */
export function useAuthModal(initialMode: AuthMode = 'login'): UseAuthModalResult {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>(initialMode)

  const open = useCallback((nextMode?: AuthMode) => {
    if (nextMode) setMode(nextMode)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const switchMode = useCallback((nextMode: AuthMode) => {
    setMode(nextMode)
  }, [])

  return { isOpen, mode, open, close, switchMode }
}
