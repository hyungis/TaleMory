import { useCallback, useEffect, useState } from 'react'
import {
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
import { useGenerationJobQuery } from '../../storyboard-prompt/model/useGenerationJobQuery'

interface FinalPreviewStepProps {
  storyId: number | null
  /** TTS 잡 jobId (HighlightOutroStep confirm 응답). null 이면 폴링 없이 즉시 scenes fetch. */
  storyGenerationJobId: number | null
  /**
   * Step 5 PATCH /style 시점에 enqueue 된 FINAL_ILLUSTRATION 잡 id.
   * null 이면 폴링 없이 (구버전 흐름 호환).
   * non-null 이면 TTS 와 함께 둘 다 SUCCESS 일 때까지 대기.
   */
  finalIllustrationJobId: number | null
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
 * storyGenerationJobId 가 있으면 TTS 잡이 SUCCESS 될 때까지 폴링하고,
 * SUCCESS(또는 jobId=null) 시점에 scenes/outro 를 fetch 한다.
 */
export function FinalPreviewStep({
  storyId,
  storyGenerationJobId,
  finalIllustrationJobId,
  onBack,
  onSaveToBookshelf,
  onOpenViewer,
  onShare,
}: FinalPreviewStepProps) {
  const ttsJobQuery = useGenerationJobQuery(storyGenerationJobId)
  const finalJobQuery = useGenerationJobQuery(finalIllustrationJobId)
  const [scenes, setScenes] = useState<SceneDto[]>([])
  const [outro, setOutro] = useState<OutroDto | null>(null)
  const [loadingScenes, setLoadingScenes] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resultPageIndex, setResultPageIndex] = useState(0)

  // 두 잡 모두 (있다면) SUCCESS 여야 fetch.
  const ttsReady = !storyGenerationJobId || ttsJobQuery.data?.status === 'SUCCESS'
  const finalReady = !finalIllustrationJobId || finalJobQuery.data?.status === 'SUCCESS'
  const shouldFetch = ttsReady && finalReady

  useEffect(() => {
    if (!storyId) {
      setLoadingScenes(false)
      setError('스토리 ID가 없습니다.')
      return
    }

    if (!shouldFetch) return

    let cancelled = false
    setLoadingScenes(true)
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
        if (!cancelled) setLoadingScenes(false)
      })
    return () => {
      cancelled = true
    }
  }, [storyId, shouldFetch])

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

  // 두 잡 중 하나라도 PENDING/RUNNING 이거나 scenes fetch 중이면 blocking.
  const ttsInProgress =
    !!storyGenerationJobId &&
    (ttsJobQuery.data?.status === 'PENDING' || ttsJobQuery.data?.status === 'RUNNING')
  const finalInProgress =
    !!finalIllustrationJobId &&
    (finalJobQuery.data?.status === 'PENDING' || finalJobQuery.data?.status === 'RUNNING')
  const blocking = ttsInProgress || finalInProgress || loadingScenes

  if (blocking) {
    // 두 잡 진행 중일 땐 "어떤 단계가 미완" 인지 사용자에게 표시.
    const message = (() => {
      if (finalInProgress && ttsInProgress) return '동화책 만드는 중... (삽화 + 음성)'
      if (finalInProgress) return '컬러 삽화 마무리 중...'
      if (ttsInProgress) return ttsJobQuery.data?.currentStep ?? '음성 생성 중...'
      return '동화 데이터 불러오는 중...'
    })()
    return (
      <div className="bookshelf-modal step-forest-modal flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#b4dc8c] animate-spin" />
        <p className="ml-4 text-[#f0e6c0] text-lg">{message}</p>
      </div>
    )
  }

  // 둘 중 하나라도 FAILED 면 에러 화면.
  const failedJob = ttsJobQuery.data?.status === 'FAILED'
    ? ttsJobQuery.data
    : finalJobQuery.data?.status === 'FAILED'
      ? finalJobQuery.data
      : null
  if (failedJob) {
    return (
      <div className="bookshelf-modal step-forest-modal flex items-center justify-center flex-col gap-4">
        <p className="text-red-400 text-lg">동화 생성에 실패했습니다.</p>
        {failedJob.errorMessage && (
          <p className="text-[#f0e6c0] text-sm">{failedJob.errorMessage}</p>
        )}
        <button
          type="button"
          onClick={onBack}
          className="bg-[#f0e6c0] text-[#2d5a27] px-6 py-2 rounded-full border-2 border-[#b4dc8c] hover:bg-[#b4dc8c] transition-all font-bold"
        >
          이전 단계로
        </button>
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
