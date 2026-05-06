import { BookOpen, ChevronLeft, ChevronRight, Image as ImageIcon, Quote, RefreshCcw } from 'lucide-react'
import type { StoryboardPageDraft } from '../../model/types'
import { SketchCard } from './SketchCard'
import { MAX_PER_PAGE_REFINE } from '../lib/defaults'

interface StoryboardSingleViewProps {
  pages: StoryboardPageDraft[]
  index: number
  onPrev: () => void
  onNext: () => void
  onPageUpdate: (idx: number, patch: Partial<StoryboardPageDraft>) => void
  pageRefineRemaining: number[]
  onRegenerate: (idx: number) => void
}

/**
 * Single view: 페이지 한 장씩 상세 — 좌측 스케치 + 우측 en/ko textarea 편집.
 * 좌/우 prev/next 버튼으로 페이지 이동.
 */
export function StoryboardSingleView({
  pages,
  index,
  onPrev,
  onNext,
  onPageUpdate,
  pageRefineRemaining,
  onRegenerate,
}: StoryboardSingleViewProps) {
  const page = pages[index]
  if (!page) return null

  const pageLeft = pageRefineRemaining[index] ?? 0
  const disabled = pageLeft <= 0

  return (
    <>
      {/* 페이지 카운터 */}
      <div className="flex justify-center mb-6">
        <div className="bg-[#2a1b12]/70 px-6 py-2.5 rounded-full border-2 border-[#4a3a24] shadow-sm flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#b4dc8c]" />
          <span className="text-[#f0e6c0] font-bold text-xl">
            {index + 1} / {pages.length}
          </span>
        </div>
      </div>

      <div className="relative flex items-center gap-4">
        {/* prev */}
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 0}
          aria-label="이전 페이지"
          className="shrink-0 bg-[#2a1b12]/70 border-2 border-[#4a3a24] w-14 h-14 rounded-full shadow-md hover:bg-[#2d5a27] hover:border-[#b4dc8c] hover:scale-110 transition-all flex items-center justify-center text-[#b4dc8c] disabled:opacity-30 disabled:hover:scale-100 disabled:hover:bg-[#2a1b12]/70 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>

        {/* 메인 카드 */}
        <div className="flex-1">
          <div className="bg-[#f0e6c0] rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.4)] border-2 border-[#2a1b12] overflow-hidden relative">
            <div className="flex flex-col lg:flex-row p-6 md:p-8 gap-8">
              {/* 왼쪽: 스케치 */}
              <div className="w-full lg:w-1/2 flex flex-col gap-3">
                <div className="flex justify-between items-center px-2">
                  <span className="bg-[#2d5a27] text-[#b4dc8c] px-4 py-1 rounded-full shadow-sm text-xl font-bold border border-[#b4dc8c]/50">
                    Page {index + 1}
                  </span>
                  <button
                    type="button"
                    className="text-base text-[#8b7a52] flex items-center gap-1 hover:text-[#2d5a27] bg-[#e8ddb4] px-3 py-1 rounded-full border border-[#8b7a52]/40"
                  >
                    <ImageIcon className="w-4 h-4" /> 참고 원본 사진
                  </button>
                </div>
                <div className="w-full aspect-[4/3] bg-[#fff9dd] border-2 border-[#b4dc8c] rounded-3xl flex flex-col items-center justify-center p-6 shadow-sm relative overflow-hidden group">
                  <SketchCard page={page} size="lg" />
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onRegenerate(index)}
                      className="bg-[#f0e6c0] text-[#2d5a27] px-5 py-2.5 rounded-full shadow-lg font-bold flex items-center gap-2 hover:bg-[#2d5a27] hover:text-[#f0e6c0] transition-transform hover:scale-105 border-2 border-[#2d5a27] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      <RefreshCcw className="w-5 h-5" /> 다른 구도로 다시 그리기
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 bg-[#e8ddb4] border border-[#8b7a52]/40 px-4 py-2 rounded-full text-base mt-1">
                  <RefreshCcw className={`w-4 h-4 ${disabled ? 'text-[#8b7a52]/50' : 'text-[#2d5a27]'}`} />
                  <span className="text-[#8b7a52]">이 그림 재생성</span>
                  <span className={`font-bold ${disabled ? 'text-[#8b7a52]/50' : 'text-[#2d5a27]'}`}>
                    {pageLeft} / {MAX_PER_PAGE_REFINE} 남음
                  </span>
                </div>
              </div>

              {/* 오른쪽: 텍스트 (en / ko) */}
              <div className="w-full lg:w-1/2 flex flex-col justify-center">
                <div className="bg-[#e8ddb4] p-6 md:p-8 rounded-3xl border-2 border-[#8b7a52]/40 relative">
                  <Quote className="absolute top-4 left-4 w-8 h-8 text-[#b4dc8c] opacity-50" />
                  <textarea
                    value={page.en}
                    onChange={e => onPageUpdate(index, { en: e.target.value })}
                    rows={5}
                    className="w-full text-3xl text-[#2d5a27] font-sans leading-relaxed mt-4 mb-4 bg-transparent border-none focus:outline-none resize-none"
                  />
                  <div className="border-t border-[#8b7a52]/40 pt-4">
                    <textarea
                      value={page.ko}
                      onChange={e => onPageUpdate(index, { ko: e.target.value })}
                      rows={3}
                      className="w-full text-[#8b7a52] text-lg bg-transparent border-none focus:outline-none resize-none font-sans"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* next */}
        <button
          type="button"
          onClick={onNext}
          disabled={index === pages.length - 1}
          aria-label="다음 페이지"
          className="shrink-0 bg-[#2a1b12]/70 border-2 border-[#4a3a24] w-14 h-14 rounded-full shadow-md hover:bg-[#2d5a27] hover:border-[#b4dc8c] hover:scale-110 transition-all flex items-center justify-center text-[#b4dc8c] disabled:opacity-30 disabled:hover:scale-100 disabled:hover:bg-[#2a1b12]/70 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      </div>
    </>
  )
}
