import type { CSSProperties } from 'react'
import type { AnchorPoint, SentenceView } from '../../model/types'

interface WebtoonBubbleProps {
  sentence: SentenceView
  position: AnchorPoint
}

/**
 * 대사 말풍선 — 스타일 A (기본 둥근 사각형 + 꼬리).
 * anchor 좌표 기반으로 이미지 위에 absolute 배치.
 * 재생 중인 대사만 렌더링되며, 다음 대사로 넘어가면 이전 말풍선은 사라짐.
 */
export function WebtoonBubble({ sentence, position }: WebtoonBubbleProps) {
  const style: CSSProperties = {
    left: `${(position.x * 100).toFixed(2)}%`,
    top: `${(position.y * 100).toFixed(2)}%`,
  }

  return (
    <div className="swt-bubble" style={style} role="note">
      {sentence.speakerKey && (
        <span className="swt-bubble-speaker">{sentence.speakerKey}</span>
      )}
      <p className="swt-bubble-text">{sentence.englishText}</p>
      <span className="swt-bubble-tail" aria-hidden="true" />
    </div>
  )
}
