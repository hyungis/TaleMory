import type { CSSProperties } from 'react'
import type { AnchorPoint, SentenceView } from '../../model/types'

interface WebtoonBubbleProps {
  sentence: SentenceView
  /**
   * 좌표 — scene.characterAnchors 에서 sentence.speakerKey 로 lookup 한 값,
   * 매칭 실패 또는 NARRATION 이면 fallback (top center). 이미지 box 기준 정규화 0~1.
   */
  position: AnchorPoint
  isActive: boolean
  showKorean: boolean
}

/**
 * 단일 말풍선 / 캡션 컴포넌트.
 *
 * - speakerKey 있는 문장 → 일반 말풍선 (anchor 위로 띄움 + tail).
 * - speakerKey 없는 NARRATION → 캡션 박스 (이미지 상단 중앙).
 *
 * 활성 sentence (현재 음성 재생 중) 는 outline 강조 — 페이지 [재생] 버튼과 연동.
 */
export function WebtoonBubble({ sentence, position, isActive, showKorean }: WebtoonBubbleProps) {
  const isNarration = !sentence.speakerKey
  const className = [
    'swt-bubble',
    isNarration ? 'is-narration' : '',
    isActive ? 'is-active' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const style: CSSProperties = {
    left: `${(position.x * 100).toFixed(2)}%`,
    top: `${(position.y * 100).toFixed(2)}%`,
  }

  return (
    <div className={className} style={style} role="note">
      <div className="swt-bubble-body">
        {!isNarration && sentence.speakerKey && (
          <span className="swt-bubble-speaker">{sentence.speakerKey}</span>
        )}
        <span>{sentence.englishText}</span>
        {showKorean && sentence.koreanText && (
          <span className="swt-bubble-korean">{sentence.koreanText}</span>
        )}
        {!isNarration && <span className="swt-bubble-tail" aria-hidden="true" />}
      </div>
    </div>
  )
}
