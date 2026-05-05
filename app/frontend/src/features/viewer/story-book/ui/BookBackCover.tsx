import { useEffect, useRef, useState } from 'react'
import { BookOpen, RotateCcw } from 'lucide-react'
import type { OutroView } from '../../model/types'
import { useLetterTyping } from '../model/useLetterTyping'

interface BookBackCoverProps {
  outro: OutroView | null
  onRestart: () => void
  /** 앞표지와 같은 일러스트(`coverIllustrationUrl`) — 뒷표지 배경에 full-bleed 로 깔린다. */
  illustrationUrl: string | null
}

/**
 * 뒷표지 + 편지지 애니메이션.
 * 표지 일러스트가 full-bleed 로 배경에 깔리고, 그 위에 다크 그라디언트 오버레이,
 * 그 위에 편지지가 날아 착지 → 글자 타이핑 → 서명/버튼 순서로 노출.
 * outro 데이터가 없으면 기본 마무리 멘트 사용.
 */
export function BookBackCover({ outro, onRestart, illustrationUrl }: BookBackCoverProps) {
  const paperRef = useRef<HTMLDivElement>(null)
  const [isLanded, setIsLanded] = useState(false)
  const text = outro?.outroText ?? '따뜻한 이야기를 함께 읽어주셔서 고마워요.'
  /* 사용자가 서명을 비워둔 경우엔 라인 자체를 숨김 — 기본 폴백("동화책 작가") 으로 메우면
     사용자 의도(익명 편지)와 어긋남. trim 후 빈 문자열도 미작성으로 간주. */
  const signature = outro?.signature?.trim() || null
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
      {illustrationUrl && (
        <img src={illustrationUrl} alt="" className="sb-back-cover-illust" />
      )}
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

        {signature && (
          <p className={`sb-letter-signature ${isComplete ? 'is-visible' : ''}`}>{signature}</p>
        )}

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
