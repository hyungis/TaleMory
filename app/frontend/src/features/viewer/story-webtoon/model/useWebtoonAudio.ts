import { useCallback, useEffect, useRef, useState } from 'react'
import type { SceneId, SentenceId } from '../../../../shared/types'
import type { SceneView, SentenceView } from '../../model/types'

/**
 * 웹툰 모드 페이지 단위 sentence 순차 재생 훅.
 *
 * 두 가지 재생 모드:
 *  - playPage(scene)      — 토글 방식. 페이지 내 [재생] 버튼에 연결.
 *  - playPageAsync(scene)  — Promise 반환. "한번에 읽기" 자동재생 루프에서 사용.
 *
 * 재생 중 activeSentenceId 가 갱신되어 말풍선 표시/하이라이트에 활용.
 */
export interface UseWebtoonAudioReturn {
  activeSceneId: SceneId | null
  activeSentenceId: SentenceId | null
  isPlaying: boolean
  playPage: (scene: SceneView) => void
  playPageAsync: (scene: SceneView) => Promise<void>
  stop: () => void
}

const SENTENCE_GAP_MS = 200

export function useWebtoonAudio(): UseWebtoonAudioReturn {
  const [activeSceneId, setActiveSceneId] = useState<SceneId | null>(null)
  const [activeSentenceId, setActiveSentenceId] = useState<SentenceId | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const advanceTimerRef = useRef<number | null>(null)
  const sceneRef = useRef<SceneView | null>(null)
  const indexRef = useRef(0)
  const onCompleteRef = useRef<(() => void) | null>(null)

  const hasSpeech =
    typeof window !== 'undefined' && 'speechSynthesis' in window

  const cancelAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (hasSpeech) window.speechSynthesis.cancel()
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }, [hasSpeech])

  const cleanup = useCallback(() => {
    cancelAll()
    sceneRef.current = null
    indexRef.current = 0
    setActiveSceneId(null)
    setActiveSentenceId(null)
    setIsPlaying(false)
  }, [cancelAll])

  const stop = useCallback(() => {
    const cb = onCompleteRef.current
    onCompleteRef.current = null
    cleanup()
    cb?.()
  }, [cleanup])

  useEffect(() => {
    return () => { cancelAll() }
  }, [cancelAll])

  const playCurrent = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return
    const idx = indexRef.current

    if (idx >= scene.sentences.length) {
      const cb = onCompleteRef.current
      onCompleteRef.current = null
      cleanup()
      cb?.()
      return
    }

    const sentence: SentenceView = scene.sentences[idx]
    setActiveSentenceId(sentence.sentenceId)

    const onFinish = () => {
      if (sceneRef.current !== scene) return
      indexRef.current = idx + 1
      advanceTimerRef.current = window.setTimeout(() => playCurrent(), SENTENCE_GAP_MS)
    }

    if (sentence.ttsAudioUrl) {
      const audio = new Audio(sentence.ttsAudioUrl)
      audio.onended = onFinish
      audio.onerror = onFinish
      audioRef.current = audio
      audio.play().catch(onFinish)
    } else if (hasSpeech) {
      const utter = new SpeechSynthesisUtterance(sentence.englishText)
      utter.lang = 'en-US'
      utter.rate = 0.95
      utter.onend = onFinish
      utter.onerror = onFinish
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
    } else {
      onFinish()
    }
  }, [hasSpeech, cleanup])

  const startScene = useCallback(
    (scene: SceneView) => {
      cancelAll()
      if (onCompleteRef.current) {
        onCompleteRef.current()
        onCompleteRef.current = null
      }
      sceneRef.current = scene
      indexRef.current = 0
      setActiveSceneId(scene.sceneId)
      setActiveSentenceId(null)
      setIsPlaying(true)
    },
    [cancelAll],
  )

  const playPage = useCallback(
    (scene: SceneView) => {
      if (sceneRef.current?.sceneId === scene.sceneId && isPlaying) {
        stop()
        return
      }
      startScene(scene)
      playCurrent()
    },
    [isPlaying, playCurrent, stop, startScene],
  )

  const playPageAsync = useCallback(
    (scene: SceneView): Promise<void> => {
      return new Promise((resolve) => {
        startScene(scene)
        onCompleteRef.current = resolve
        setTimeout(() => playCurrent(), 0)
      })
    },
    [playCurrent, startScene],
  )

  return {
    activeSceneId,
    activeSentenceId,
    isPlaying,
    playPage,
    playPageAsync,
    stop,
  }
}
