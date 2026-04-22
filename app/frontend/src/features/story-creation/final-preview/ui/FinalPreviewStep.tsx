import { useCallback, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Library,
  Maximize,
  Share2,
} from 'lucide-react'
import type { ProjectData } from '../../model/types'
import { BookSpread } from './BookSpread'

interface FinalPreviewStepProps {
  projectData: ProjectData
  onBack: () => void
  /** "내 책장 보관하기" — 제작 플로우 종료 후 메인(서점) 으로 복귀. */
  onSaveToBookshelf: () => void
  /** "뷰어로 열기" — 풀스크린 react-pageflip 뷰어로 이동. */
  onOpenViewer: () => void
  /** "링크 공유하기" — navigator.share API 또는 fallback. */
  onShare?: () => void
}

/**
 * STEP 07 — "완성된 동화책"
 *
 * 구조:
 *  - 성공 배지 "🎉 세상에 하나뿐인 동화책 완성!"
 *  - 펼쳐진 책 스프레드 (좌: 삽화 / 우: 본문 + 보이스 플레이어)
 *  - 좌우 chevron 네비 (책 양쪽 끝 돌출)
 *  - 하단 Page N / Total 뱃지
 *  - 3 개 액션: 내 책장 보관하기 / 뷰어로 열기 / 링크 공유하기
 */
export function FinalPreviewStep({
  projectData,
  onBack,
  onSaveToBookshelf,
  onOpenViewer,
  onShare,
}: FinalPreviewStepProps) {
  const pages = projectData.step4.pages
  const [resultPageIndex, setResultPageIndex] = useState(0)

  const currentPage = pages[resultPageIndex] ?? pages[0]

  const prevPage = useCallback(() => {
    setResultPageIndex(i => Math.max(0, i - 1))
  }, [])

  const nextPage = useCallback(() => {
    setResultPageIndex(i => Math.min(pages.length - 1, i + 1))
  }, [pages.length])

  const handleShareFallback = useCallback(() => {
    if (onShare) {
      onShare()
      return
    }
    // Navigator.share API fallback (데스크톱에서 미지원 시)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      navigator
        .share({
          title: '우리 가족 동화책',
          text: 'TaleMory 로 만든 동화책을 확인해보세요!',
          url: window.location.origin,
        })
        .catch(() => {
          /* 사용자 취소 */
        })
    } else {
      alert('공유 링크 생성은 발행(publish) 후 사용 가능합니다. Task 8 에서 연결됩니다.')
    }
  }, [onShare])

  if (!currentPage) {
    return (
      <div className="bookshelf-modal step-forest-modal flex items-center justify-center">
        <p className="text-[#f0e6c0] text-lg">스토리보드 페이지가 없습니다. step 4 로 돌아가세요.</p>
      </div>
    )
  }

  return (
    <div className="bookshelf-modal step-forest-modal">
      {/* Step 헤더 */}
      <div className="flex items-center justify-between py-4 px-8 border-b border-[#4a3a24] bg-[#2a1b12]/60 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="이전 단계"
            className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-[#4a3a24] text-[#d6c78e] bg-[#2a1b12]/70 hover:bg-[#2d5a27]/40 hover:text-[#f0e6c0] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-[#b4c4a4] text-sm font-bold tracking-wider">STEP 07 / 08</span>
          <span className="bookshelf-title-display text-2xl text-[#f0e6c0] font-bold">
            완성된 동화책
          </span>
        </div>
      </div>

      <div className="bookshelf-scroll">
        <main className="py-10 px-4 md:px-10 bookshelf-fade-in">
          <div className="max-w-6xl mx-auto pb-12">
            {/* 성공 배지 */}
            <div className="text-center mb-8">
              <div className="inline-block bg-[#2d5a27] text-[#b4dc8c] px-5 py-2 rounded-full text-base mb-4 border border-[#b4dc8c]/50 shadow-[0_0_20px_rgba(180,220,140,0.4)] font-bold">
                🎉 세상에 하나뿐인 동화책 완성!
              </div>
            </div>

            {/* 펼쳐진 책 + 좌우 chevron (책 외곽에 돌출) */}
            <div className="relative">
              <BookSpread
                page={currentPage}
                pageIndex={resultPageIndex}
                voiceModel={projectData.step6.voiceModel}
              />

              {/* 페이지 넘김 화살표 */}
              <button
                type="button"
                onClick={prevPage}
                disabled={resultPageIndex === 0}
                aria-label="이전 페이지"
                className="absolute left-[-18px] md:left-[-24px] top-1/2 -translate-y-1/2 bg-[#f0e6c0] text-[#2d5a27] p-3 md:p-4 rounded-full shadow-lg border-2 border-[#2d5a27] transition-all z-30 hover:scale-110 hover:bg-[#b4dc8c] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
              </button>
              <button
                type="button"
                onClick={nextPage}
                disabled={resultPageIndex >= pages.length - 1}
                aria-label="다음 페이지"
                className="absolute right-[-18px] md:right-[-24px] top-1/2 -translate-y-1/2 bg-[#f0e6c0] text-[#2d5a27] p-3 md:p-4 rounded-full shadow-lg border-2 border-[#2d5a27] transition-all z-30 hover:scale-110 hover:bg-[#b4dc8c] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
              </button>
            </div>

            {/* 페이지 표시 */}
            <div className="text-center mt-6">
              <span className="inline-flex items-center gap-2 bg-[#2a1b12]/70 text-[#b4dc8c] px-4 py-1.5 rounded-full text-sm font-bold border border-[#4a3a24]">
                <BookOpen className="w-4 h-4" />
                Page {resultPageIndex + 1} / {pages.length}
              </span>
            </div>

            {/* 하단 공유 액션 */}
            <div className="mt-12 flex flex-col sm:flex-row flex-wrap justify-center gap-4">
              <button
                type="button"
                onClick={onSaveToBookshelf}
                className="bg-[#f0e6c0] text-[#2d5a27] text-xl px-10 py-4 rounded-full shadow-md border-2 border-[#b4dc8c] hover:bg-[#b4dc8c] transition-all flex items-center justify-center gap-2 font-bold"
              >
                <Library className="w-6 h-6" /> 내 책장 보관하기
              </button>
              <button
                type="button"
                onClick={onOpenViewer}
                className="bg-[#2d5a27] text-[#f0e6c0] text-xl px-10 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_6px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.5)] hover:bg-[#3d6f34] transition-all font-bold flex items-center justify-center gap-2"
              >
                <Maximize className="w-6 h-6" /> 뷰어로 열기
              </button>
              <button
                type="button"
                onClick={handleShareFallback}
                className="bg-[#c97b4a] text-[#f0e6c0] text-xl px-10 py-4 rounded-full shadow-[0_6px_0_#8b3a2a] hover:translate-y-1 hover:shadow-[0_2px_0_#8b3a2a] hover:bg-[#d88a58] transition-all font-bold flex items-center justify-center gap-2"
              >
                <Share2 className="w-6 h-6" /> 링크 공유하기
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
