import { useEffect, useRef, useState } from 'react'
import { BookOpen, RotateCcw } from 'lucide-react'
import type { OutroView } from '../../model/types'
import { useLetterTyping } from '../model/useLetterTyping'

interface BookBackCoverProps {
  outro: OutroView | null
  onRestart: () => void
}

/**
 * 뒷표지 + 편지지 애니메이션.
 * 편지지가 위에서 날아 착지 → 글자 타이핑 → 서명/버튼 노출 순서.
 * outro 데이터가 없으면 기본 마무리 멘트 사용.
 */
export function BookBackCover({ outro, onRestart }: BookBackCoverProps) {
  const paperRef = useRef<HTMLDivElement>(null)
  const [isLanded, setIsLanded] = useState(false)
  const text = outro?.outroText ?? '따뜻한 이야기를 함께 읽어주셔서 고마워요.'
  const signature = outro?.signature ?? '— 동화책 작가'
  const audioUrl = outro?.audioUrl ?? null

  const [replayKey, setReplayKey] = useState(0)
  const { chars, isComplete } = useLetterTyping(text, true)

  // 편지지 날아드는 애니메이션: mount 직후 is-landing 클래스 붙이기
  useEffect(() => {
    if (!paperRef.current) return
    setIsLanded(false)
    // reflow 강제 후 애니메이션 재시작
    void paperRef.current.offsetWidth
    setIsLanded(true)
  }, [replayKey])

  // 오디오 있을 때만 재생
  useEffect(() => {
    if (!audioUrl) return
    const audio = new Audio(audioUrl)
    audio.play().catch(() => {
      /* 자동재생 차단 시 무시 — 사용자 제스처 후 수동 재생 유도 가능 */
    })
    return () => {
      audio.pause()
    }
  }, [audioUrl, replayKey])

  const handleReplay = () => {
    setReplayKey(k => k + 1)
  }

  return (
    <div className="sb-back-cover">
      <div
        ref={paperRef}
        key={replayKey}
        className={`sb-letter ${isLanded ? 'is-landing' : ''}`}
      >
        <p className="sb-letter-text">
          {chars.map((char, idx) => {
            if (char.kind === 'newline') {
              return <span key={idx} className="sb-letter-char newline" style={{ animationDelay: `${char.delayMs}ms` }}><br /></span>
            }
            if (char.kind === 'space') {
              return <span key={idx} className="sb-letter-char space" style={{ animationDelay: `${char.delayMs}ms` }}>&nbsp;</span>
            }
            return <span key={idx} className="sb-letter-char" style={{ animationDelay: `${char.delayMs}ms` }}>{char.ch}</span>
          })}
        </p>

        <p className={`sb-letter-signature ${isComplete ? 'is-visible' : ''}`}>{signature}</p>

        <div className={`sb-letter-controls ${isComplete ? 'is-visible' : ''}`}>
          <button className="sb-letter-btn" onClick={handleReplay}>
            <RotateCcw className="w-4 h-4" />
            다시 듣기
          </button>
          <button className="sb-letter-btn" onClick={onRestart}>
            <BookOpen className="w-4 h-4" />
            처음부터 읽기
          </button>
        </div>
      </div>
    </div>
  )
}
