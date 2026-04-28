import type { Story } from '../../../../entities/story'
import { StoryCard } from './StoryCard'

interface BookshelfRowProps {
  books: Story[]
  rowIdx: number
  itemsPerRow: number
  gridColsClass: string
  onRead?: (story: Story) => void
  onShare?: (story: Story) => void
  onDelete?: (story: Story) => void
}

/**
 * 한 줄(shelf) 단위 렌더러.
 * - 원목 상판(.wood-texture) + 앞면 + 양쪽 철제 브래킷 decorative
 * - 상단 grid 에 N 권의 책 카드
 */
export function BookshelfRow({
  books,
  rowIdx,
  itemsPerRow,
  gridColsClass,
  onRead,
  onShare,
  onDelete,
}: BookshelfRowProps) {
  return (
    <div className="relative w-full px-2 sm:px-6 pt-6">
      {/* 원목 선반 윗면 — 위 가장자리에 이끼 wash 가 자라난 손그림 톤 */}
      <div className="absolute bottom-0 left-0 w-full h-14 bg-[#b57a4c] wood-texture wood-texture--shelf-top rounded-t-sm z-10 overflow-hidden" />
      {/* 선반 앞면 — vertical 결 강화 */}
      <div className="absolute top-full left-0 w-full h-8 bg-[#6a4225] wood-texture wood-texture--shelf-front border-t border-[#4f2d15] shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] rounded-b-md z-10" />
      {/* 철제 브래킷 */}
      <div className="absolute top-full left-0 w-full h-8 flex justify-between px-[12%] z-0">
        {[0, 1].map(i => (
          <div
            key={i}
            className="w-5 h-16 bg-gradient-to-b from-[#e0e0e0] via-[#999] to-[#555] shadow-[4px_5px_15px_rgba(0,0,0,0.6)] rounded-b-xl border-x border-[#777] relative"
          >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#333] rounded-full shadow-inner" />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#333] rounded-full shadow-inner" />
          </div>
        ))}
      </div>

      {/* 책 그리드 */}
      <div className={`grid ${gridColsClass} gap-8 items-end relative z-20 pb-3 px-4 sm:px-8`}>
        {books.map((book, idx) => (
          <StoryCard
            key={book.id}
            story={book}
            onRead={onRead}
            onShare={onShare}
            onDelete={onDelete}
            animationDelayMs={(rowIdx * itemsPerRow + idx) * 50}
          />
        ))}
      </div>
    </div>
  )
}
