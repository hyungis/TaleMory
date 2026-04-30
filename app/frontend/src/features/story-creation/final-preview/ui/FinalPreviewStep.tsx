import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Library,
  Loader2,
  Maximize,
  Share2,
} from 'lucide-react'
import { BookSpread } from './BookSpread'
import {
  getScenes,
  getOutro,
  type SceneDto,
  type OutroDto,
} from '../../highlight-outro/api/highlightOutroApi'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'

interface FinalPreviewStepProps {
  storyId: number | null
  onBack: () => void
  /** "내 책장 보관하기" — 제작 플로우 종료 후 메인(서점) 으로 복귀. */
  onSaveToBookshelf: () => void
  /** "뷰어로 열기" — 풀스크린 react-pageflip 뷰어로 이동. */
  onOpenViewer: () => void
  /** "링크 공유하기" — navigator.share API 또는 fallback. */
  onShare?: () => void
}

/**
 * STEP 08 — "완성된 동화책"
 *
 * 서버에서 scenes + outro 를 조회하여 실제 삽화/본문/TTS 를 표시한다.
 */
export function FinalPreviewStep({
  storyId,
  onBack,
  onSaveToBookshelf,
  onOpenViewer,
  onShare,
}: FinalPreviewStepProps) {
  const [scenes, setScenes] = useState<SceneDto[]>([])
  const [outro, setOutro] = useState<OutroDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resultPageIndex, setResultPageIndex] = useState(0)

  useEffect(() => {
    if (!storyId) {
      setLoading(false)
      setError('스토리 ID가 없습니다.')
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([getScenes(storyId), getOutro(storyId)])
      .then(([scenesData, outroData]) => {
        if (cancelled) return
        setScenes(scenesData)
        setOutro(outroData)
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setError('동화 데이터를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [storyId])

  const totalPages = scenes.length
  const currentScene = scenes[resultPageIndex] ?? null

  const prevPage = useCallback(() => {
    setResultPageIndex(i => Math.max(0, i - 1))
  }, [])

  const nextPage = useCallback(() => {
    setResultPageIndex(i => Math.min(totalPages - 1, i + 1))
  }, [totalPages])

  const handleShareFallback = useCallback(() => {
    if (onShare) {
      onShare()
      return
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      navigator
        .share({
          title: '우리 가족 동화책',
          text: 'TaleMory 로 만든 동화책을 확인해보세요!',
          url: window.location.origin,
        })
        .catch(() => {})
    } else {
      alert('공유 링크 생성은 발행(publish) 후 사용 가능합니다.')
    }
  }, [onShare])

  if (loading) {
    return (
      <div className="bookshelf-modal step-forest-modal flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#b4dc8c] animate-spin" />
      </div>
    )
  }

  if (error || !currentScene) {
    return (
      <div className="bookshelf-modal step-forest-modal flex items-center justify-center">
        <p className="text-[#f0e6c0] text-lg">
          {error ?? '씬 데이터가 없습니다. 이전 단계를 확인하세요.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bookshelf-modal step-forest-modal">
      <CreationHeader currentStep={8} />

      <div className="bookshelf-scroll">
        <main className="py-10 px-6 md:px-12 lg:px-24 xl:px-32 2xl:px-40 bookshelf-fade-in">
          <div className="max-w-6xl mx-auto pb-12">
            {/* 성공 배지 */}
            <div className="text-center mb-8">
              <div className="inline-block bg-[#2d5a27] text-[#b4dc8c] px-5 py-2 rounded-full text-base mb-4 border border-[#b4dc8c]/50 shadow-[0_0_20px_rgba(180,220,140,0.4)] font-bold">
                세상에 하나뿐인 동화책 완성!
              </div>
            </div>

            {/* 펼쳐진 책 + 좌우 chevron */}
            <div className="relative">
              <BookSpread scene={currentScene} pageIndex={resultPageIndex} />

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
                disabled={resultPageIndex >= totalPages - 1}
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
                Page {resultPageIndex + 1} / {totalPages}
              </span>
            </div>

            {/* 아웃트로 표시 (있을 때만) */}
            {outro && (
              <div className="mt-8 max-w-2xl mx-auto bg-[#f0e6c0]/90 rounded-2xl p-6 border border-[#8b7a52]/30 shadow-inner">
                <p className="text-[#2a1b12] text-lg leading-relaxed text-center italic">
                  {outro.outroText}
                </p>
                {outro.signature && (
                  <p className="text-right text-[#8b7a52] mt-3 font-bold">— {outro.signature}</p>
                )}
              </div>
            )}

            {/* 하단 액션 */}
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

      <CreationFooter currentStep={8} onBack={onBack} />
    </div>
  )
}
