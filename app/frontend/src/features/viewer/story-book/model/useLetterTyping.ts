import { useEffect, useMemo, useState } from 'react'

const CHAR_DELAY_MS = 75

/**
 * 편지지 글자 타이핑 애니메이션 상태 훅.
 * - 각 글자에 animationDelay 를 매겨 순차 등장시키고,
 * - 전체 타이핑이 끝난 시점에 시그니처/버튼을 노출한다.
 */
export interface TypingChar {
  ch: string
  kind: 'char' | 'space' | 'newline'
  delayMs: number
}

export interface LetterTypingState {
  chars: TypingChar[]
  isComplete: boolean
  replay: () => void
}

export function useLetterTyping(text: string, enabled: boolean): LetterTypingState {
  const [tick, setTick] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  const chars = useMemo<TypingChar[]>(() => {
    return Array.from(text).map((ch, index) => ({
      ch,
      kind: ch === '\n' ? 'newline' : ch === ' ' ? 'space' : 'char',
      delayMs: index * CHAR_DELAY_MS,
    }))
  }, [text])

  useEffect(() => {
    if (!enabled) {
      setIsComplete(false)
      return
    }
    setIsComplete(false)
    const totalDuration = text.length * CHAR_DELAY_MS + 400
    const timer = window.setTimeout(() => setIsComplete(true), totalDuration)
    return () => window.clearTimeout(timer)
  }, [enabled, text, tick])

  return {
    chars,
    isComplete,
    replay: () => setTick(t => t + 1),
  }
}
