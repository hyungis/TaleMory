import type { CSSProperties } from 'react'
import type { AnchorPoint, SentenceView } from '../../model/types'

interface WebtoonBubbleProps {
  sentence: SentenceView
  position: AnchorPoint
  isNarration?: boolean
}

/**
 * 말풍선 — 대사(스타일 A: 둥근 사각형 + 꼬리) / 나레이션(스타일 B: 상단 중앙 박스).
 * anchor 좌표 기반으로 이미지 위에 absolute 배치.
 * 재생 중인 문장만 렌더링되며, 다음 문장으로 넘어가면 이전 말풍선은 사라짐.
 */
export function WebtoonBubble({ sentence, position, isNarration = false }: WebtoonBubbleProps) {
  const style: CSSProperties = {
    left: `${(position.x * 100).toFixed(2)}%`,
    top: `${(position.y * 100).toFixed(2)}%`,
  }

  const className = isNarration ? 'swt-bubble swt-bubble--narration' : 'swt-bubble'

  return (
    <div className={className} style={style} role="note">
      {!isNarration && sentence.speakerKey && (
        <span className="swt-bubble-speaker">{sentence.speakerKey}</span>
      )}
      <p className="swt-bubble-text">{sentence.englishText}</p>
      {!isNarration && <span className="swt-bubble-tail" aria-hidden="true" />}
    </div>
  )
}
