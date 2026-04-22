import { useCallback, useEffect, useState } from 'react'

export type Scene = 'forest' | 'bookstore'

export interface UseSceneTransitionResult {
  currentScene: Scene
  /** 숲 → 서점 전환. history.pushState 로 뒤로가기 지원. */
  enterBookstore: () => void
  /** 서점 → 숲 전환. */
  backToForest: () => void
}

/**
 * MainPage 내부의 forest ↔ bookstore 씬 전환 state machine.
 *
 * 원본 App.jsx 가 `currentScene` state + `window.history.pushState/popstate` 패턴으로
 * 브라우저 뒤로가기로도 씬 전환이 가능했던 동작을 유지한다.
 *
 * 라우트는 `/main` 단일로 두고 내부에서 opacity crossfade 로 전환한다
 * (scene-container/bookstore-scene + .active/.inactive).
 */
export function useSceneTransition(initial: Scene = 'forest'): UseSceneTransitionResult {
  const [currentScene, setCurrentScene] = useState<Scene>(initial)

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { scene?: Scene } | null
      if (state?.scene === 'bookstore') {
        setCurrentScene('bookstore')
      } else {
        setCurrentScene('forest')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const enterBookstore = useCallback(() => {
    setCurrentScene('bookstore')
    window.history.pushState({ scene: 'bookstore' }, '')
  }, [])

  const backToForest = useCallback(() => {
    setCurrentScene('forest')
    window.history.pushState({ scene: 'forest' }, '')
  }, [])

  return { currentScene, enterBookstore, backToForest }
}
