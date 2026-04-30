import { ChevronLeft, ChevronRight } from 'lucide-react'

interface BookshelfPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

/**
 * 책장 페이지네이션 컨트롤 (이전 / 페이지 숫자 / 다음).
 * totalPages <= 1 인 경우 렌더되지 않음 (BookshelfModal 에서 가드).
 */
export function BookshelfPagination({ currentPage, totalPages, onPageChange }: BookshelfPaginationProps) {
  const canPrev = currentPage > 1
  const canNext = currentPage < totalPages

  return (
    <div className="flex justify-center items-center gap-2 mt-20 relative z-20">
      <button
        type="button"
        onClick={() => canPrev && onPageChange(currentPage - 1)}
        disabled={!canPrev}
        aria-label="이전 페이지"
        className={`w-10 h-10 rounded-full flex items-center justify-center border border-[#9A7548]/40 text-[#3E2A18] bg-[#E9DBBE] transition-colors shadow-sm ${
          canPrev ? 'hover:bg-[#B9D38F] hover:border-[#8DBA64] cursor-pointer' : 'opacity-40 cursor-not-allowed'
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
                ? 'w-10 h-10 rounded-full flex items-center justify-center bg-[#8DBA64] text-[#1F3318] font-bold shadow-[0_0_10px_rgba(141,186,100,0.35)] border border-[#B9D38F]'
                : 'w-10 h-10 rounded-full flex items-center justify-center border border-[#9A7548]/40 bg-[#E9DBBE] text-[#3E2A18] hover:bg-[#B9D38F] hover:border-[#8DBA64] transition-colors cursor-pointer shadow-sm'
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
        className={`w-10 h-10 rounded-full flex items-center justify-center border border-[#9A7548]/40 text-[#3E2A18] bg-[#E9DBBE] transition-colors shadow-sm ${
          canNext ? 'hover:bg-[#B9D38F] hover:border-[#8DBA64] cursor-pointer' : 'opacity-40 cursor-not-allowed'
        }`}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}
