import { ArrowRight, X } from 'lucide-react'
import type { StoryboardPageDraft } from '../../model/types'
import { SketchCard } from './SketchCard'

const KOREAN_TEXT_STYLE = {
  fontFamily: "'Gaegu', 'Nanum Pen Script', cursive",
  fontWeight: 700,
  letterSpacing: 0,
} as const

interface PagePreviewModalProps {
  previewIndex: number | null
  pages: StoryboardPageDraft[]
  onClose: () => void
  /** "이 페이지 자세히 보기" — Single view + 해당 index 로 전환. */
  onGoToDetail: () => void
}

/**
 * Grid view 에서 페이지 썸네일 클릭 시 열리는 미리보기 모달.
 */
export function PagePreviewModal({
  previewIndex,
  pages,
  onClose,
  onGoToDetail,
}: PagePreviewModalProps) {
  if (previewIndex === null) return null
  const p = pages[previewIndex]
  if (!p) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center bookshelf-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#f0e6c0] rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)] border-2 border-[#2a1b12] max-w-2xl w-full p-8 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-4 right-4 text-[#8b7a52] hover:text-[#2d5a27] bg-[#e8ddb4] w-10 h-10 rounded-full border-2 border-[#8b7a52]/40 flex items-center justify-center hover:bg-[#b4dc8c] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <span className="bg-[#2d5a27] text-[#b4dc8c] px-4 py-1 rounded-full shadow-sm text-xl font-bold border border-[#b4dc8c]/50">
            Page {previewIndex + 1}
          </span>
          <h2 className="text-3xl text-[#2d5a27] font-bold">페이지 미리보기</h2>
        </div>

        <div className="w-full aspect-[4/3] bg-[#fff9dd] border-2 border-[#b4dc8c] rounded-3xl flex flex-col items-center justify-center p-6 shadow-sm mb-5">
          <SketchCard page={p} size="lg" />
        </div>

        <div className="bg-[#e8ddb4] p-5 rounded-2xl border-2 border-[#8b7a52]/40 mb-5">
          <p className="text-[#2d5a27] text-lg leading-relaxed" style={KOREAN_TEXT_STYLE}>{p.ko}</p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onGoToDetail}
            className="bg-[#2d5a27] text-[#f0e6c0] px-8 py-3 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14] hover:translate-y-0.5 hover:shadow-[0_2px_0_#1a3a14] hover:bg-[#3d6f34] transition-all font-bold text-xl flex items-center gap-2"
          >
            이 페이지 자세히 보기 <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
