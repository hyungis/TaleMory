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
      {/* 선반 윗면 — 매끈한 honey tan, 라운드 코너 */}
      <div className="absolute bottom-0 left-0 w-full h-14 bg-[#C9A874] wood-texture wood-texture--shelf-top rounded-t-xl z-10 overflow-hidden" />
      {/* 선반 앞면 — 살짝 짙은 tan, 부드러운 drop shadow */}
      <div className="absolute top-full left-0 w-full h-8 bg-[#9A7548] wood-texture wood-texture--shelf-front border-t border-[#6B4A28]/50 shadow-[0_14px_22px_-8px_rgba(107,74,40,0.32)] rounded-b-xl z-10" />
      {/* 청동 브래킷 — 메탈 그레이 → bronze 톤 (디자인 시스템과 통일) */}
      <div className="absolute top-full left-0 w-full h-8 flex justify-between px-[12%] z-0">
        {[0, 1].map(i => (
          <div
            key={i}
            className="w-5 h-16 bg-gradient-to-b from-[#D9BE82] via-[#9A7548] to-[#6B4A28] shadow-[3px_4px_10px_rgba(107,74,40,0.45)] rounded-b-xl border-x border-[#9A7548]/60 relative"
          >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#3E2A18] rounded-full shadow-inner" />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#3E2A18] rounded-full shadow-inner" />
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
