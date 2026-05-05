import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PartyPopper,
  Wand2,
} from 'lucide-react'
import { BookSpread } from './BookSpread'
import {
  getScenes,
  type SceneDto,
} from '../../highlight-outro/api/highlightOutroApi'
import { postIllustrationRegenerate } from '../../storyboard-editor/api/postIllustrationRegenerate'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
import { StepTitleBlock } from '../../ui/StepTitleBlock'
import { useGenerationJobQuery } from '../../storyboard-prompt/model/useGenerationJobQuery'
import { isApiError } from '../../../../shared/api'
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
 * 페이지마다 최종 삽화를 다시 그릴 수 있는 횟수. 백엔드의 SCENE_REGEN_LIMIT 와 동일.
 * 실제 BE 가 진실의 원천이고, FE 는 안내+가드 용으로만 사용. BE 가 limit 초과 시 409.
 */
const REGEN_LIMIT_PER_SCENE = 3

/**
 * STEP 08 — 최종 미리보기 + 페이지별 삽화 재생성 (paper-craft 톤).
 *
 * 책임:
 *   - 동화 데이터 fetch (scenes/outro) 와 잡 폴링(TTS + FINAL_ILLUSTRATION)
 *   - 펼친 책 형태로 페이지 미리보기
 *   - 페이지마다 최대 {@link REGEN_LIMIT_PER_SCENE} 번까지 삽화 재생성 — 프롬프트 입력 후
 *     `POST /scenes/{sceneId}/illustration/regenerate` 트리거 → 잡 폴링 → 성공 시 scenes 재조회
 *
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
  const [loadingScenes, setLoadingScenes] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resultPageIndex, setResultPageIndex] = useState(0)

  /* 페이지별 삽화 재생성 상태 — 동시에 1개 잡만 진행 (다른 페이지 regen 버튼 disabled).
     - activeRegen: 진행 중인 잡 sceneId/jobId
     - regenCounts: 페이지별 재생성 횟수 (FE 안내용; BE 가 진짜 limit 진실)
     - openPromptScene: 프롬프트 입력 패널이 열린 sceneId (한 번에 1곳만)
     - regenError: 인라인 에러 메시지 (limit 초과 / 네트워크 등) */
  const [activeRegen, setActiveRegen] = useState<{ sceneId: number; jobId: number } | null>(null)
  const regenJobQuery = useGenerationJobQuery(activeRegen?.jobId ?? null)
  const [regenCounts, setRegenCounts] = useState<Record<number, number>>({})
  const [openPromptScene, setOpenPromptScene] = useState<number | null>(null)
  const [promptText, setPromptText] = useState('')
  const [regenError, setRegenError] = useState<string | null>(null)

  /* 발행 확인 모달 — "발행하기" 클릭 시 즉시 onNext 호출하지 않고 사용자 확인 받음.
     Step 9 진입 = 자동 발행이라 클릭 한 번이 곧 발행 트리거이기 때문. */
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)

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
    getScenes(storyId)
      .then(scenesData => {
        if (cancelled) return
        setScenes(scenesData)
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

  /* regen 잡 폴링 — SUCCESS/FAILED 시 후처리.
     SUCCESS: scenes 재조회로 새 illustrationUrl 반영, 진행상태 초기화
     FAILED/CANCELLED: 인라인 에러 표시, 진행상태만 초기화 (count 는 유지 — BE 가 row 만들었으니) */
  useEffect(() => {
    if (!activeRegen) return
    const status = regenJobQuery.data?.status
    if (status === 'SUCCESS') {
      if (storyId) {
        getScenes(storyId)
          .then(updated => setScenes(updated))
          .catch(() => {
            /* 재조회 실패는 silent — 다음 마운트 시 다시 시도 */
          })
      }
      setActiveRegen(null)
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      setRegenError('재생성에 실패했어요. 잠시 후 다시 시도해주세요.')
      setActiveRegen(null)
    }
  }, [regenJobQuery.data?.status, activeRegen, storyId])

  const coverScene = scenes.find(scene => scene.pageNumber === 0) ?? null
  const bodyScenes = coverScene ? scenes.filter(scene => scene.pageNumber !== 0) : scenes
  const previewPages = coverScene
    ? [{ kind: 'cover' as const, scene: coverScene }, ...bodyScenes.map(scene => ({ kind: 'scene' as const, scene }))]
    : bodyScenes.map(scene => ({ kind: 'scene' as const, scene }))
  const totalPages = previewPages.length
  const currentPreviewPage = previewPages[resultPageIndex] ?? null
  const currentScene = currentPreviewPage?.kind === 'scene' ? currentPreviewPage.scene : null

  const prevPage = useCallback(() => {
    setResultPageIndex(i => Math.max(0, i - 1))
    setOpenPromptScene(null)
    setRegenError(null)
  }, [])

  const nextPage = useCallback(() => {
    setResultPageIndex(i => Math.min(totalPages - 1, i + 1))
    setOpenPromptScene(null)
    setRegenError(null)
  }, [totalPages])

  // ===== 재생성 핸들러 =====
  const handleOpenPrompt = useCallback((sceneId: number) => {
    setRegenError(null)
    setOpenPromptScene(sceneId)
    setPromptText('')
  }, [])

  const handleClosePrompt = useCallback(() => {
    setOpenPromptScene(null)
    setPromptText('')
  }, [])

  const handleSubmitRegen = useCallback(async () => {
    if (!storyId || openPromptScene === null) return
    const trimmed = promptText.trim()
    if (!trimmed) {
      setRegenError('어떻게 바꾸고 싶은지 적어주세요.')
      return
    }
    setRegenError(null)
    try {
      const result = await postIllustrationRegenerate(storyId, openPromptScene, trimmed)
      setRegenCounts(prev => ({
        ...prev,
        [openPromptScene]: (prev[openPromptScene] ?? 0) + 1,
      }))
      setActiveRegen({ sceneId: openPromptScene, jobId: result.jobId })
      setOpenPromptScene(null)
      setPromptText('')
    } catch (err) {
      if (isApiError(err) && err.code === 'REGENERATION_LIMIT_EXCEEDED') {
        setRegenError('이 페이지의 다시 그리기 횟수를 다 썼어요.')
        // FE 카운터를 limit 까지 동기화
        setRegenCounts(prev => ({ ...prev, [openPromptScene]: REGEN_LIMIT_PER_SCENE }))
      } else if (isApiError(err)) {
        setRegenError(err.message ?? '재생성 요청에 실패했어요.')
      } else {
        setRegenError('재생성 요청에 실패했어요. 잠시 후 다시 시도해주세요.')
      }
    }
  }, [storyId, openPromptScene, promptText])

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
      if (ttsInProgress) return '음성 생성 중...'
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
  if (error || !currentPreviewPage) {
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
  const currentSceneId = currentScene?.id ?? null
  const currentRegenCount = currentSceneId !== null ? (regenCounts[currentSceneId] ?? 0) : 0
  const remaining = Math.max(0, REGEN_LIMIT_PER_SCENE - currentRegenCount)
  const isCurrentRegenPending = activeRegen?.sceneId === currentSceneId
  const isAnyRegenPending = activeRegen !== null
  const canRegen = currentSceneId !== null && !isAnyRegenPending && remaining > 0
  const isPanelOpen = openPromptScene === currentSceneId

  return (
    <div className="cr-shell">
      <CreationDoodlesBg />
      <CreationHeader currentStep={8} />

      <div className="cr-scroll">
        <main className="cr-shell-inner cr-fade-in" style={{ maxWidth: 1200 }}>
          <StepTitleBlock
            stepNumber={8}
            title="최종 미리보기"
            subtitle={`마지막으로 펼쳐보세요. 마음에 안 드는 삽화는 페이지마다 ${REGEN_LIMIT_PER_SCENE}번까지 다시 그릴 수 있어요.`}
          />

          <section className="cr-card">
            <span className="cr-tape" aria-hidden="true" />

            <div style={{ position: 'relative' }}>
              {currentPreviewPage.kind === 'cover' ? (
                <div className="cr-final-cover-shell">
                  {currentPreviewPage.scene.illustrationUrl ? (
                    <img className="cr-final-cover-image" src={currentPreviewPage.scene.illustrationUrl} alt="" />
                  ) : (
                    <BookOpen className="cr-final-cover-icon" strokeWidth={1.5} />
                  )}
                </div>
              ) : (
                <BookSpread scene={currentPreviewPage.scene} pageIndex={resultPageIndex - (coverScene ? 1 : 0)} />
              )}

              {isCurrentRegenPending && (
                <div className="cr-final-regen-overlay">
                  <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#fdf6dc' }} />
                  <p className="cr-final-regen-overlay-text">삽화를 다시 그리고 있어요...</p>
                </div>
              )}

              <button
                type="button"
                onClick={prevPage}
                disabled={resultPageIndex === 0 || isAnyRegenPending}
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
                disabled={resultPageIndex >= totalPages - 1 || isAnyRegenPending}
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
                {currentPreviewPage.kind === 'cover'
                  ? `Cover / ${totalPages}`
                  : `Page ${resultPageIndex + (coverScene ? 0 : 1)} / ${totalPages}`}
              </span>
            </div>

            {/* ===== 페이지별 삽화 재생성 ===== */}
            {currentSceneId !== null && (
            <div className="cr-final-regen-bar">
              <button
                type="button"
                className="cr-final-regen-trigger"
                onClick={() => currentSceneId !== null && handleOpenPrompt(currentSceneId)}
                disabled={!canRegen || isPanelOpen}
              >
                <Wand2 className="w-4 h-4" />
                {remaining > 0 ? '이 페이지 삽화 다시 그리기' : '더 이상 다시 그릴 수 없어요'}
              </button>
              <p className="cr-final-regen-meta">
                이 페이지에서 <strong>{remaining}/{REGEN_LIMIT_PER_SCENE}</strong> 회 더 가능해요.
              </p>

              {isPanelOpen && (
                <div className="cr-final-regen-panel">
                  <div className="cr-final-regen-panel-head">
                    <h4 className="cr-final-regen-panel-title">어떻게 바꾸고 싶나요?</h4>
                  </div>
                  <textarea
                    className="cr-final-regen-textarea"
                    placeholder="예) 햇살이 더 따뜻하게, 아이 표정을 환하게 그려주세요"
                    value={promptText}
                    onChange={e => setPromptText(e.target.value)}
                    autoFocus
                    disabled={isAnyRegenPending}
                  />
                  <div className="cr-final-regen-actions">
                    <button
                      type="button"
                      className="cr-final-regen-cancel"
                      onClick={handleClosePrompt}
                      disabled={isAnyRegenPending}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className="cr-final-regen-submit"
                      onClick={handleSubmitRegen}
                      disabled={!promptText.trim() || isAnyRegenPending}
                    >
                      다시 그리기
                    </button>
                  </div>
                </div>
              )}

              {regenError && <p className="cr-final-regen-error">{regenError}</p>}
            </div>
            )}
          </section>

        </main>
      </div>

      <CreationFooter
        currentStep={8}
        onBack={onBack}
        /* 직접 onNext 호출하지 말고 확인 모달을 띄움 — Step 9 진입 = 자동 발행이라
           사용자에게 한 번 더 확인 받는 게 안전. */
        onNext={() => setShowPublishConfirm(true)}
        nextLabel="발행하기"
        nextDisabled={isAnyRegenPending}
      />

      {/* 발행 확인 모달 */}
      {showPublishConfirm && (
        <div
          className="cr-publish-confirm-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPublishConfirm(false)}
        >
          <div className="cr-publish-confirm-card" onClick={e => e.stopPropagation()}>
            <span className="cr-tape" aria-hidden="true" />
            <h3 className="cr-publish-confirm-title">동화책을 발행할까요?</h3>
            <p className="cr-publish-confirm-desc">
              발행하면 공유 링크가 만들어지고,
              <br />
              더 이상 이전 단계로 돌아갈 수 없어요.
            </p>
            <div className="cr-publish-confirm-actions">
              <button
                type="button"
                className="cr-publish-confirm-cancel"
                onClick={() => setShowPublishConfirm(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="cr-publish-confirm-submit"
                onClick={() => {
                  setShowPublishConfirm(false)
                  onNext()
                }}
              >
                <PartyPopper className="w-4 h-4" />
                네, 발행할게요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
