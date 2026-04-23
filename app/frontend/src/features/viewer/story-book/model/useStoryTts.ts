import { useEffect, useRef, useState } from 'react'
import type { SceneView, SentenceView } from '../../model/types'

/**
 * 동화책 뷰어 TTS 재생 훅.
 *
 * 3가지 재생 모드:
 *  - `sentence`: 특정 문장 하나만 재생
 *  - `page`    : 한 페이지의 모든 문장 순차 재생
 *  - `fullBook`: 여러 페이지 연속 재생 — 페이지 경계에서 `onSceneChange` 콜백으로 상위 컴포넌트가
 *                실제 페이지 플립을 수행하도록 위임한다
 *
 * 오디오 소스 우선순위: `sentence.ttsAudioUrl` (있으면 `<audio>`) → 없으면 브라우저 `SpeechSynthesis`.
 * 브라우저가 TTS 를 지원하지 않고 URL 도 없으면 조용히 다음 문장으로 진행한다.
 */

type Mode = 'idle' | 'playing' | 'paused'

interface TtsStatus {
  mode: Mode
  /** 현재 재생 중인 문장 id — UI 에서 하이라이트 용도 */
  activeSentenceId: number | null
  /** 현재 재생 중인 scene id */
  activeSceneId: number | null
}

type PlayMode = 'sentence' | 'page' | 'fullBook'

interface PlayContext {
  scenes: SceneView[]
  sceneIndex: number
  sentenceIndex: number
  mode: PlayMode
  onSceneChange?: (sceneIndex: number) => void
}

export interface UseStoryTtsReturn {
  status: TtsStatus
  speakSentence: (scene: SceneView, sentence: SentenceView) => void
  speakPage: (scene: SceneView) => void
  speakFullBook: (
    scenes: SceneView[],
    startSceneIndex: number,
    onSceneChange: (sceneIndex: number) => void,
  ) => void
  pause: () => void
  resume: () => void
  stop: () => void
}

const IDLE_STATUS: TtsStatus = { mode: 'idle', activeSentenceId: null, activeSceneId: null }
const SCENE_TRANSITION_DELAY_MS = 700
const SENTENCE_GAP_MS = 200

export function useStoryTts(): UseStoryTtsReturn {
  const [status, setStatus] = useState<TtsStatus>(IDLE_STATUS)
  const contextRef = useRef<PlayContext | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const advanceTimerRef = useRef<number | null>(null)

  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window

  const cancelPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (hasSpeech) {
      window.speechSynthesis.cancel()
    }
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }

  const stop = () => {
    cancelPlayback()
    contextRef.current = null
    setStatus(IDLE_STATUS)
  }

  useEffect(() => {
    return () => {
      cancelPlayback()
      contextRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const playCurrent = () => {
    const ctx = contextRef.current
    if (!ctx) return

    const scene = ctx.scenes[ctx.sceneIndex]
    if (!scene) {
      stop()
      return
    }

    // 현재 scene 의 문장 끝에 도달 — 다음 장 / 종료 판단
    if (ctx.sentenceIndex >= scene.sentences.length) {
      if (ctx.mode === 'fullBook' && ctx.sceneIndex + 1 < ctx.scenes.length) {
        ctx.sceneIndex += 1
        ctx.sentenceIndex = 0
        ctx.onSceneChange?.(ctx.sceneIndex)
        advanceTimerRef.current = window.setTimeout(() => playCurrent(), SCENE_TRANSITION_DELAY_MS)
        return
      }
      stop()
      return
    }

    const sentence = scene.sentences[ctx.sentenceIndex]
    setStatus({ mode: 'playing', activeSceneId: scene.sceneId, activeSentenceId: sentence.sentenceId })

    const onFinishSentence = () => {
      // 컨텍스트가 교체됐거나 중단됐으면 폐기 (빠른 연속 클릭 대응)
      if (contextRef.current !== ctx) return
      ctx.sentenceIndex += 1
      if (ctx.mode === 'sentence') {
        stop()
        return
      }
      advanceTimerRef.current = window.setTimeout(() => playCurrent(), SENTENCE_GAP_MS)
    }

    if (sentence.ttsAudioUrl) {
      const audio = new Audio(sentence.ttsAudioUrl)
      audio.onended = onFinishSentence
      audio.onerror = onFinishSentence
      audioRef.current = audio
      audio.play().catch(() => onFinishSentence())
    } else if (hasSpeech) {
      const utter = new SpeechSynthesisUtterance(sentence.englishText)
      utter.lang = 'en-US'
      utter.rate = 0.95
      utter.onend = onFinishSentence
      utter.onerror = onFinishSentence
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
    } else {
      // 브라우저 TTS 미지원 + 오디오 URL 없음 — 조용히 스킵
      onFinishSentence()
    }
  }

  const speakSentence = (scene: SceneView, sentence: SentenceView) => {
    stop()
    const sIdx = scene.sentences.findIndex(s => s.sentenceId === sentence.sentenceId)
    if (sIdx < 0) return
    contextRef.current = {
      scenes: [scene],
      sceneIndex: 0,
      sentenceIndex: sIdx,
      mode: 'sentence',
    }
    playCurrent()
  }

  const speakPage = (scene: SceneView) => {
    stop()
    contextRef.current = {
      scenes: [scene],
      sceneIndex: 0,
      sentenceIndex: 0,
      mode: 'page',
    }
    playCurrent()
  }

  const speakFullBook = (
    scenes: SceneView[],
    startSceneIndex: number,
    onSceneChange: (sceneIndex: number) => void,
  ) => {
    stop()
    contextRef.current = {
      scenes,
      sceneIndex: startSceneIndex,
      sentenceIndex: 0,
      mode: 'fullBook',
      onSceneChange,
    }
    playCurrent()
  }

  const pause = () => {
    if (audioRef.current) audioRef.current.pause()
    if (hasSpeech) window.speechSynthesis.pause()
    setStatus(prev => (prev.mode === 'playing' ? { ...prev, mode: 'paused' } : prev))
  }

  const resume = () => {
    if (audioRef.current) audioRef.current.play().catch(() => {})
    if (hasSpeech) window.speechSynthesis.resume()
    setStatus(prev => (prev.mode === 'paused' ? { ...prev, mode: 'playing' } : prev))
  }

  return { status, speakSentence, speakPage, speakFullBook, pause, resume, stop }
}
