import { useCallback, useEffect, useRef, useState } from 'react'
import type { SceneId, SentenceId } from '../../../../shared/types'
import type { SceneView, SentenceView } from '../../model/types'

/**
 * 웹툰 모드 페이지 단위 sentence 순차 재생 훅.
 *
 * 책 모드의 useStoryTts 와 책임이 비슷하지만 웹툰 뷰어는 페이지 별 [재생] 트리거
 * + 활성 sentence 하이라이트(말풍선 강조) 만 필요해 단순화. 책 모드와 분리해
 * 책 모드 전용 fullBook / pause-resume 로직을 끌고오지 않는다.
 *
 * 정책:
 *  - sentence.ttsAudioUrl 이 있으면 `<Audio>`, 없으면 SpeechSynthesis fallback,
 *    둘 다 없으면 조용히 다음 문장으로 진행.
 *  - playPage 호출 시 같은 페이지가 이미 재생 중이면 stop (toggle).
 *  - 다른 페이지로 이동(unmount 또는 다른 playPage 호출) 시 자동 stop.
 */
export interface UseWebtoonAudioReturn {
  activeSceneId: SceneId | null
  activeSentenceId: SentenceId | null
  isPlaying: boolean
  playPage: (scene: SceneView) => void
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

  const stop = useCallback(() => {
    cancelAll()
    sceneRef.current = null
    indexRef.current = 0
    setActiveSceneId(null)
    setActiveSentenceId(null)
    setIsPlaying(false)
  }, [cancelAll])

  // unmount 안전 — 컴포넌트 사라지면 모든 native handle 해제.
  useEffect(() => {
    return () => {
      cancelAll()
    }
  }, [cancelAll])

  const playCurrent = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return
    const idx = indexRef.current

    if (idx >= scene.sentences.length) {
      stop()
      return
    }

    const sentence: SentenceView = scene.sentences[idx]
    setActiveSentenceId(sentence.sentenceId)

    const onFinish = () => {
      // 재생 도중 다른 페이지로 stop 됐는지 가드.
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
  }, [hasSpeech, stop])

  const playPage = useCallback(
    (scene: SceneView) => {
      // 같은 페이지를 다시 누르면 toggle off.
      if (sceneRef.current?.sceneId === scene.sceneId && isPlaying) {
        stop()
        return
      }
      cancelAll()
      sceneRef.current = scene
      indexRef.current = 0
      setActiveSceneId(scene.sceneId)
      setActiveSentenceId(null)
      setIsPlaying(true)
      playCurrent()
    },
    [cancelAll, isPlaying, playCurrent, stop],
  )

  return {
    activeSceneId,
    activeSentenceId,
    isPlaying,
    playPage,
    stop,
  }
}
