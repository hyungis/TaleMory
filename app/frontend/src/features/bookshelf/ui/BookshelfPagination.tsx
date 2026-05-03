import { ChevronLeft, ChevronRight } from 'lucide-react'

interface BookshelfPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

/**
 * 책장 페이지네이션 (이전 / 페이지 숫자 / 다음) — 손그림 paper-cream pill 톤.
 * totalPages <= 1 인 경우 렌더되지 않음 (BookshelfModal 에서 가드).
 */
export function BookshelfPagination({ currentPage, totalPages, onPageChange }: BookshelfPaginationProps) {
  const canPrev = currentPage > 1
  const canNext = currentPage < totalPages

  const baseBtn =
    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors shadow-[0_2px_0_rgba(163,117,72,0.25)]'

  return (
    <div
      className="flex justify-center items-center gap-2 mt-16 relative z-20"
      style={{ fontFamily: 'var(--font-display)' }}
    >
      <button
        type="button"
        onClick={() => canPrev && onPageChange(currentPage - 1)}
        disabled={!canPrev}
        aria-label="이전 페이지"
        className={`${baseBtn} bg-[#F0DBA8] border-[#a37548]/55 text-[#6B4A28] ${
          canPrev ? 'hover:bg-[#E8D08F] cursor-pointer' : 'opacity-40 cursor-not-allowed'
        }`}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
        const isCurrent = page === currentPage
        return (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={
              isCurrent
                ? `${baseBtn} bg-[#7a9968] border-[#5e7a4f] text-[#FFFEF8] font-bold`
                : `${baseBtn} bg-[#F0DBA8] border-[#a37548]/55 text-[#6B4A28] hover:bg-[#E8D08F] cursor-pointer`
            }
          >
            {page}
          </button>
        )
      })}

      <button
        type="button"
        onClick={() => canNext && onPageChange(currentPage + 1)}
        disabled={!canNext}
        aria-label="다음 페이지"
        className={`${baseBtn} bg-[#F0DBA8] border-[#a37548]/55 text-[#6B4A28] ${
          canNext ? 'hover:bg-[#E8D08F] cursor-pointer' : 'opacity-40 cursor-not-allowed'
        }`}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}
