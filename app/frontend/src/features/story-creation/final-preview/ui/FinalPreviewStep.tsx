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
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
import { useGenerationJobQuery } from '../../storyboard-prompt/model/useGenerationJobQuery'
import '../../styles/creation-paper.css'

interface FinalPreviewStepProps {
  storyId: number | null
  storyGenerationJobId: number | null
  /**
   * Step 5 PATCH /style 시점에 enqueue 된 FINAL_ILLUSTRATION 잡 id.
   * null 이면 폴링 없이 (구버전 흐름 호환).
   * non-null 이면 TTS 와 함께 둘 다 SUCCESS 일 때까지 대기.
   */
  finalIllustrationJobId: number | null
  onBack: () => void
  onSaveToBookshelf: () => void
  onOpenViewer: () => void
  onShare?: () => void
}

/**
 * STEP 08 — paper-craft 톤 (Claude offline.html 1:1).
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
      <div className="cr-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--cr-sage-deep)' }} />
          <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 18, color: 'var(--cr-ink)', margin: 0 }}>
            {message}
          </p>
        </div>
      </div>
    )
  }

  // 둘 중 하나라도 terminal-error(FAILED/CANCELLED) 면 에러 화면.
  const isTerminalError = (status?: string) => status === 'FAILED' || status === 'CANCELLED'
  const failedJob = isTerminalError(ttsJobQuery.data?.status)
    ? ttsJobQuery.data
    : isTerminalError(finalJobQuery.data?.status)
      ? finalJobQuery.data
      : null
  if (failedJob) {
    return (
      <div
        className="cr-shell"
        style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}
      >
        <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 18, color: 'var(--cr-rust)' }}>
          동화 생성에 실패했어요.
        </p>
        {failedJob.errorMessage && (
          <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 14, color: 'var(--cr-ink-soft)' }}>
            {failedJob.errorMessage}
          </p>
        )}
        <button type="button" onClick={onBack} className="cr-btn-back">
          이전 단계로
        </button>
      </div>
    )
  }

  if (error || !currentScene) {
    return (
      <div className="cr-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 18, color: 'var(--cr-ink)' }}>
          {error ?? '씬 데이터가 없어요. 이전 단계를 확인하세요.'}
        </p>
      </div>
    )
  }

  return (
    <div className="cr-shell">
      <CreationDoodlesBg />
      <CreationHeader currentStep={8} />

      <div className="cr-scroll">
        <main className="cr-shell-inner cr-fade-in" style={{ maxWidth: 1300 }}>
          {/* 성공 배지 */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--cr-sage)',
                color: '#fdf6dc',
                padding: '8px 22px',
                borderRadius: 999,
                border: '2px solid var(--cr-sage-deep)',
                boxShadow: '0 3px 0 var(--cr-sage-deep), 0 6px 14px rgba(95,125,80,0.25)',
                fontFamily: 'var(--cr-font-serif)',
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              ✦ 세상에 하나뿐인 동화책 완성!
            </span>
          </div>

          {/* 펼쳐진 책 + 좌우 chevron */}
          <div style={{ position: 'relative' }}>
            <BookSpread scene={currentScene} pageIndex={resultPageIndex} />

            <button
              type="button"
              onClick={prevPage}
              disabled={resultPageIndex === 0}
              aria-label="이전 페이지"
              style={{
                position: 'absolute',
                left: -18,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--cr-paper)',
                color: 'var(--cr-ink)',
                border: '2px solid var(--cr-caramel-deep)',
                boxShadow: '0 3px 0 var(--cr-caramel-deep), 0 6px 14px rgba(140,100,60,0.2)',
                display: 'grid',
                placeItems: 'center',
                cursor: resultPageIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: resultPageIndex === 0 ? 0.4 : 1,
                zIndex: 30,
              }}
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <button
              type="button"
              onClick={nextPage}
              disabled={resultPageIndex >= totalPages - 1}
              aria-label="다음 페이지"
              style={{
                position: 'absolute',
                right: -18,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--cr-paper)',
                color: 'var(--cr-ink)',
                border: '2px solid var(--cr-caramel-deep)',
                boxShadow: '0 3px 0 var(--cr-caramel-deep), 0 6px 14px rgba(140,100,60,0.2)',
                display: 'grid',
                placeItems: 'center',
                cursor: resultPageIndex >= totalPages - 1 ? 'not-allowed' : 'pointer',
                opacity: resultPageIndex >= totalPages - 1 ? 0.4 : 1,
                zIndex: 30,
              }}
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          </div>

          {/* 페이지 표시 */}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#fbf2da',
                color: 'var(--cr-ink-soft)',
                padding: '6px 16px',
                borderRadius: 999,
                border: '1.5px solid var(--cr-caramel)',
                fontFamily: 'var(--cr-font-serif)',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              <BookOpen className="w-4 h-4" />
              Page {resultPageIndex + 1} / {totalPages}
            </span>
          </div>

          {/* 아웃트로 */}
          {outro && (
            <div
              style={{
                marginTop: 32,
                maxWidth: 640,
                marginInline: 'auto',
                position: 'relative',
                background: 'linear-gradient(135deg, #fbf2da 0%, #f5e6bd 100%)',
                border: '2.5px solid var(--cr-caramel-deep)',
                borderRadius: 22,
                padding: '22px 26px',
                boxShadow: '0 2px 0 var(--cr-caramel-deep), 0 8px 22px rgba(140,100,60,0.16)',
              }}
            >
              <span className="cr-tape" aria-hidden="true" />
              <p
                style={{
                  fontFamily: 'var(--cr-font-serif)',
                  fontSize: 18,
                  color: 'var(--cr-ink)',
                  lineHeight: 1.6,
                  textAlign: 'center',
                  fontStyle: 'italic',
                  margin: 0,
                }}
              >
                {outro.outroText}
              </p>
              {outro.signature && (
                <p
                  style={{
                    textAlign: 'right',
                    fontFamily: 'var(--cr-font-gaegu)',
                    fontSize: 16,
                    color: 'var(--cr-ink-soft)',
                    fontWeight: 700,
                    margin: '12px 0 0',
                  }}
                >
                  — {outro.signature}
                </p>
              )}
            </div>
          )}

          {/* 하단 액션 */}
          <div
            style={{
              marginTop: 40,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 14,
            }}
          >
            <button type="button" onClick={onSaveToBookshelf} className="cr-btn-back" style={{ justifySelf: 'auto', padding: '14px 24px', fontSize: 17 }}>
              <Library className="w-5 h-5" /> 내 책장 보관하기
            </button>
            <button type="button" onClick={onOpenViewer} className="cr-btn-next" style={{ justifySelf: 'auto', padding: '14px 24px', fontSize: 17 }}>
              <Maximize className="w-5 h-5" /> 뷰어로 열기
            </button>
            <button
              type="button"
              onClick={handleShareFallback}
              style={{
                background: 'var(--cr-rust)',
                color: '#fdf6dc',
                border: '2px solid #8a4a32',
                borderRadius: 999,
                padding: '14px 24px',
                fontFamily: 'var(--cr-font-serif)',
                fontWeight: 700,
                fontSize: 17,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 3px 0 #8a4a32, 0 6px 14px rgba(140,60,40,0.25)',
              }}
            >
              <Share2 className="w-5 h-5" /> 링크 공유하기
            </button>
          </div>
        </main>
      </div>

      <CreationFooter currentStep={8} onBack={onBack} />
    </div>
  )
}
