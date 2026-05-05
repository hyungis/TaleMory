import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
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
import { StepTitleBlock } from '../../ui/StepTitleBlock'
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
  /** Step 9 (PublishStoryStep) 로 이동 — 실제 발행/공유/책장보관/뷰어는 거기서. */
  onNext: () => void
}

/**
 * STEP 08 — 완성된 동화책 미리보기 (paper-craft 톤).
 * 다른 step 들과 동일하게 `<StepTitleBlock>` + `<section className="cr-card">` + 손글씨 폰트.
 * 발행/책장보관/뷰어/공유 같은 실제 액션은 Step 9 (PublishStoryStep) 로 위임.
 */
export function FinalPreviewStep({
  storyId,
  storyGenerationJobId,
  finalIllustrationJobId,
  onBack,
  onNext,
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

  // 두 잡 중 하나라도 PENDING/RUNNING 이거나 scenes fetch 중이면 blocking.
  const ttsInProgress =
    !!storyGenerationJobId &&
    (ttsJobQuery.data?.status === 'PENDING' || ttsJobQuery.data?.status === 'RUNNING')
  const finalInProgress =
    !!finalIllustrationJobId &&
    (finalJobQuery.data?.status === 'PENDING' || finalJobQuery.data?.status === 'RUNNING')
  const blocking = ttsInProgress || finalInProgress || loadingScenes

  // ===== 진행 중 화면 =====
  if (blocking) {
    const message = (() => {
      if (finalInProgress && ttsInProgress) return '동화책 만드는 중... (삽화 + 음성)'
      if (finalInProgress) return '컬러 삽화 마무리 중...'
      if (ttsInProgress) return ttsJobQuery.data?.currentStep ?? '음성 생성 중...'
      return '동화 데이터 불러오는 중...'
    })()
    return (
      <div className="cr-shell">
        <CreationDoodlesBg />
        <CreationHeader currentStep={8} />
        <div className="cr-scroll">
          <main className="cr-shell-inner cr-fade-in cr-final-status">
            <div className="cr-final-status-inner">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--cr-sage-deep)' }} />
              <p className="cr-final-status-text">{message}</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // ===== terminal-error (FAILED/CANCELLED) =====
  const isTerminalError = (status?: string) => status === 'FAILED' || status === 'CANCELLED'
  const failedJob = isTerminalError(ttsJobQuery.data?.status)
    ? ttsJobQuery.data
    : isTerminalError(finalJobQuery.data?.status)
      ? finalJobQuery.data
      : null
  if (failedJob) {
    return (
      <div className="cr-shell">
        <CreationDoodlesBg />
        <CreationHeader currentStep={8} />
        <div className="cr-scroll">
          <main
            className="cr-shell-inner cr-fade-in cr-final-status"
            style={{ flexDirection: 'column', gap: 14 }}
          >
            <div className="cr-final-status-inner" style={{ flexDirection: 'column', gap: 10, padding: '22px 28px' }}>
              <p className="cr-final-status-error-msg">동화 생성에 실패했어요.</p>
              {failedJob.errorMessage && (
                <p className="cr-final-status-error-detail">{failedJob.errorMessage}</p>
              )}
              <button type="button" onClick={onBack} className="cr-btn-back" style={{ marginTop: 6 }}>
                이전 단계로
              </button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // ===== 데이터 없음 =====
  if (error || !currentScene) {
    return (
      <div className="cr-shell">
        <CreationDoodlesBg />
        <CreationHeader currentStep={8} />
        <div className="cr-scroll">
          <main className="cr-shell-inner cr-fade-in cr-final-status">
            <div className="cr-final-status-inner">
              <p className="cr-final-status-text">
                {error ?? '씬 데이터가 없어요. 이전 단계를 확인하세요.'}
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // ===== 정상 화면 =====
  return (
    <div className="cr-shell">
      <CreationDoodlesBg />
      <CreationHeader currentStep={8} />

      <div className="cr-scroll">
        <main className="cr-shell-inner cr-fade-in" style={{ maxWidth: 1200 }}>
          <StepTitleBlock
            stepNumber={8}
            title="동화책이 완성됐어요"
            subtitle="펼쳐진 책처럼 한 장씩 넘기며 미리 살펴보세요."
          />

          {/* 책 펼침 + 페이지 넘김 + 페이지 인디케이터 */}
          <section className="cr-card">
            <span className="cr-tape" aria-hidden="true" />

            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <span className="cr-final-badge">
                <Sparkles className="w-4 h-4" />
                세상에 하나뿐인 동화책 완성!
              </span>
            </div>

            <div style={{ position: 'relative' }}>
              <BookSpread scene={currentScene} pageIndex={resultPageIndex} />

              <button
                type="button"
                onClick={prevPage}
                disabled={resultPageIndex === 0}
                aria-label="이전 페이지"
                className="cr-final-nav-arrow"
                style={{
                  position: 'absolute',
                  left: -22,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 30,
                }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextPage}
                disabled={resultPageIndex >= totalPages - 1}
                aria-label="다음 페이지"
                className="cr-final-nav-arrow"
                style={{
                  position: 'absolute',
                  right: -22,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 30,
                }}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <span className="cr-final-page-pill">
                <BookOpen className="w-4 h-4" />
                Page {resultPageIndex + 1} / {totalPages}
              </span>
            </div>
          </section>

          {/* 아웃트로 — 별도 카드로 분리 */}
          {outro && (
            <section className="cr-card" style={{ maxWidth: 720, marginInline: 'auto', marginTop: 28 }}>
              <span className="cr-tape" aria-hidden="true" />
              <p className="cr-final-outro-text">{outro.outroText}</p>
              {outro.signature && <p className="cr-final-outro-signature">— {outro.signature}</p>}
            </section>
          )}
        </main>
      </div>

      <CreationFooter
        currentStep={8}
        onBack={onBack}
        onNext={onNext}
        nextLabel="발행하러 가기"
      />
    </div>
  )
}
