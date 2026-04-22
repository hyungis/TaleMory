import { BookHeart, ZoomIn } from 'lucide-react'
import type { StoryboardPageDraft } from '../../model/types'
import { SketchCard } from './SketchCard'

interface StoryboardGridViewProps {
  storySummary: string
  pages: StoryboardPageDraft[]
  onPagePreview: (idx: number) => void
}

/**
 * Grid view: 스토리 요약 카드 + 페이지 썸네일 그리드.
 * 썸네일 클릭 시 PagePreviewModal 오픈.
 */
export function StoryboardGridView({ storySummary, pages, onPagePreview }: StoryboardGridViewProps) {
  return (
    <>
      {/* 스토리 요약 카드 */}
      <div className="bg-[#f0e6c0] rounded-[2rem] border-2 border-[#2a1b12] shadow-[0_20px_60px_rgba(0,0,0,0.4)] p-6 md:p-8 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#2d5a27] p-3 rounded-full border border-[#b4dc8c]/50">
            <BookHeart className="w-6 h-6 text-[#f0e6c0]" />
          </div>
          <h2 className="text-2xl text-[#2d5a27] font-bold">이 동화책은 어떤 이야기인가요?</h2>
        </div>
        <div className="bg-[#e8ddb4] p-6 rounded-2xl border-2 border-[#8b7a52]/40">
          <p className="text-[#2d5a27] text-lg leading-relaxed font-sans whitespace-pre-wrap">
            {storySummary}
          </p>
        </div>
      </div>

      {/* 페이지 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {pages.map((p, i) => (
          <div
            key={i}
            onClick={() => onPagePreview(i)}
            className="flex flex-col gap-3 cursor-pointer group/card"
          >
            <div className="flex justify-between items-center px-2">
              <span className="bg-[#2d5a27] text-[#b4dc8c] px-4 py-1 rounded-full shadow-sm text-lg font-bold border border-[#b4dc8c]/50">
                Page {i + 1}
              </span>
            </div>
            <div className="w-full aspect-[4/3] bg-[#f0e6c0] border-2 border-[#b4dc8c] rounded-3xl flex flex-col items-center justify-center p-4 shadow-sm relative overflow-hidden group-hover/card:border-[#2d5a27] group-hover/card:shadow-[0_8px_24px_rgba(45,90,39,0.25)] transition-all">
              <SketchCard page={p} size="sm" />
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
                <div className="bg-[#f0e6c0] text-[#2d5a27] px-5 py-2 rounded-full shadow-lg font-bold flex items-center gap-2 text-sm border-2 border-[#2d5a27]">
                  <ZoomIn className="w-4 h-4" /> 클릭하여 미리보기
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
