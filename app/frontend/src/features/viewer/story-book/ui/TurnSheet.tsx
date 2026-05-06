import type { SceneView } from '../../model/types'
import { BookSpreadLeft, BookSpreadRight } from './BookSpread'

interface TurnSheetProps {
  direction: 'next' | 'prev'
  fromScene: SceneView
  fromIndex: number
  toScene: SceneView
  toIndex: number
  onEnd: () => void
}

/**
 * 반쪽 종이(50% width)가 책등을 축으로 180도 회전하는 플립 오버레이.
 * - next: 오른쪽 반이 왼쪽으로 넘어감 → front 는 현재의 오른쪽, back 은 다음의 왼쪽
 * - prev: 왼쪽 반이 오른쪽으로 넘어감 → front 는 현재의 왼쪽, back 은 이전의 오른쪽
 * 애니메이션 끝날 때 onEnd 콜백.
 */
export function TurnSheet({ direction, fromScene, fromIndex, toScene, toIndex, onEnd }: TurnSheetProps) {
  return (
    <div
      className={`sb-turn-sheet ${direction}`}
      onAnimationEnd={onEnd}
    >
      <div className="sb-sheet-face front">
        {direction === 'next'
          ? <BookSpreadRight scene={fromScene} pageIndex={fromIndex} />
          : <BookSpreadLeft scene={fromScene} pageIndex={fromIndex} />}
      </div>
      <div className="sb-sheet-face back">
        {direction === 'next'
          ? <BookSpreadLeft scene={toScene} pageIndex={toIndex} />
          : <BookSpreadRight scene={toScene} pageIndex={toIndex} />}
      </div>
    </div>
  )
}
