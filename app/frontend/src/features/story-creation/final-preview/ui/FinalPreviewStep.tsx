import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import type { JobId, SceneId, StoryId } from '../../../../shared/types'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  PartyPopper,
  RefreshCw,
  Wand2,
} from 'lucide-react'
import { BookSpread } from './BookSpread'
import {
  getScenes,
  type SceneDto,
} from '../../highlight-outro/api/highlightOutroApi'
import {
  getIllustrationRegenStatus,
  getIllustrationVersions,
  postSelectIllustrationVersion,
  type IllustrationRegenStatusResponse,
  type IllustrationVersionEntry,
  type IllustrationVersionsResponse,
} from '../api/illustrationVersions'
import { postIllustrationRegenerate } from '../../storyboard-editor/api/postIllustrationRegenerate'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
import { StepTitleBlock } from '../../ui/StepTitleBlock'
import { useGenerationJobQuery } from '../../storyboard-prompt/model/useGenerationJobQuery'
import { isApiError } from '../../../../shared/api'
import '../../styles/creation-paper.css'

interface FinalPreviewStepProps {
  storyId: StoryId | null
  storyGenerationJobId: JobId | null
  finalIllustrationJobId: JobId | null
  onBack: () => void
  onNext: () => void
}

const REGEN_LIMIT_TOTAL = 3

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

  const [activeRegen, setActiveRegen] = useState<{ sceneId: SceneId; jobId: JobId } | null>(null)
  const regenJobQuery = useGenerationJobQuery(activeRegen?.jobId ?? null)
  const [regenStatus, setRegenStatus] = useState<IllustrationRegenStatusResponse | null>(null)
  const [openPromptScene, setOpenPromptScene] = useState<SceneId | null>(null)
  const [promptText, setPromptText] = useState('')
  const [regenError, setRegenError] = useState<string | null>(null)
  const [versionInfo, setVersionInfo] = useState<IllustrationVersionsResponse | null>(null)
  const [versionLoading, setVersionLoading] = useState(false)
  const [versionReloadKey, setVersionReloadKey] = useState(0)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)

  const ttsReady = !storyGenerationJobId || ttsJobQuery.data?.status === 'SUCCESS'
  const finalReady = !finalIllustrationJobId || finalJobQuery.data?.status === 'SUCCESS'
  const shouldFetch = ttsReady && finalReady

  useEffect(() => {
    if (!storyId) {
      return
    }

    if (!shouldFetch) return

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setLoadingScenes(true)
    })
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

  const refreshRegenStatus = useCallback(() => {
    if (!storyId) return
    getIllustrationRegenStatus(storyId)
      .then(setRegenStatus)
      .catch(() => {
        // 횟수 조회 실패가 미리보기 렌더링을 막지는 않게 둔다.
      })
  }, [storyId])

  useEffect(() => {
    refreshRegenStatus()
  }, [refreshRegenStatus])

  useEffect(() => {
    if (!activeRegen) return
    const status = regenJobQuery.data?.status
    if (status === 'SUCCESS') {
      if (storyId) {
        getScenes(storyId)
          .then(updated => setScenes(updated))
          .catch(() => {
              // 다음 진입 때 다시 조회된다.
            })
      }
      refreshRegenStatus()
      queueMicrotask(() => {
        setVersionReloadKey(key => key + 1)
        setActiveRegen(null)
      })
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      refreshRegenStatus()
      queueMicrotask(() => {
        setRegenError('재생성에 실패했습니다. 잠시 후 다시 시도해주세요.')
        setActiveRegen(null)
      })
    }
  }, [regenJobQuery.data?.status, activeRegen, storyId, refreshRegenStatus])

  const coverScene = scenes.find(scene => scene.pageNumber === 0) ?? null
  const bodyScenes = coverScene ? scenes.filter(scene => scene.pageNumber !== 0) : scenes
  const previewPages = coverScene
    ? [{ kind: 'cover' as const, scene: coverScene }, ...bodyScenes.map(scene => ({ kind: 'scene' as const, scene }))]
    : bodyScenes.map(scene => ({ kind: 'scene' as const, scene }))
  const totalPages = previewPages.length
  const bodyPageCount = bodyScenes.length
  const currentPreviewPage = previewPages[resultPageIndex] ?? null
  const currentScene = currentPreviewPage?.kind === 'scene' ? currentPreviewPage.scene : null
  const currentSceneId = currentScene?.id ?? null

  useEffect(() => {
    if (!storyId || currentSceneId === null) {
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setVersionLoading(true)
    })
    getIllustrationVersions(storyId, currentSceneId)
      .then(info => {
        if (!cancelled) setVersionInfo(info)
      })
      .catch(() => {
        if (!cancelled) setVersionInfo(null)
      })
      .finally(() => {
        if (!cancelled) setVersionLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [storyId, currentSceneId, versionReloadKey])

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

  const handleOpenPrompt = useCallback((sceneId: SceneId) => {
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
      setRegenStatus(prev => prev
        ? {
            ...prev,
            used: Math.min(prev.limit, prev.used + 1),
            remaining: Math.max(0, prev.remaining - 1),
          }
        : prev)
      setActiveRegen({ sceneId: openPromptScene, jobId: result.jobId })
      setOpenPromptScene(null)
      setPromptText('')
    } catch (err) {
      if (isApiError(err) && err.code === 'REGENERATION_LIMIT_EXCEEDED') {
        setRegenError('이 동화의 다시 그리기 횟수를 모두 사용했습니다.')
        setRegenStatus(prev => prev
          ? { ...prev, used: prev.limit, remaining: 0 }
          : { storyId, used: REGEN_LIMIT_TOTAL, limit: REGEN_LIMIT_TOTAL, remaining: 0 })
      } else if (isApiError(err)) {
        setRegenError(err.message ?? '재생성 요청에 실패했습니다.')
      } else {
        setRegenError('재생성 요청에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    }
  }, [storyId, openPromptScene, promptText])

  const handleSelectVersion = useCallback(async (version: number) => {
    if (!storyId || currentSceneId === null) return
    try {
      const result = await postSelectIllustrationVersion(storyId, currentSceneId, version)
      setScenes(prev => prev.map(scene => (
        scene.id === currentSceneId
          ? { ...scene, illustrationUrl: result.illustrationUrl }
          : scene
      )))
      setVersionInfo(prev => prev ? { ...prev, current: result.version } : prev)
      setRegenError(null)
    } catch (err) {
      if (isApiError(err)) {
        setRegenError(err.message ?? '삽화 버전 변경에 실패했습니다.')
      } else {
        setRegenError('삽화 버전 변경에 실패했습니다.')
      }
    }
  }, [storyId, currentSceneId])

  const ttsInProgress =
    !!storyGenerationJobId &&
    (ttsJobQuery.data?.status === 'PENDING' || ttsJobQuery.data?.status === 'RUNNING')
  const finalInProgress =
    !!finalIllustrationJobId &&
    (finalJobQuery.data?.status === 'PENDING' || finalJobQuery.data?.status === 'RUNNING')
  const missingStoryError = !storyId ? '스토리 ID가 없습니다.' : null
  const blocking = ttsInProgress || finalInProgress || (loadingScenes && storyId !== null)

  if (blocking) {
    const message = (() => {
      if (finalInProgress && ttsInProgress) return '동화책을 만드는 중이에요... (삽화 + 음성)'
      if (finalInProgress) return '컬러 삽화를 마무리하는 중이에요...'
      if (ttsInProgress) return '음성을 생성하는 중이에요...'
      return '동화 데이터를 불러오는 중이에요...'
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
              <p className="cr-final-status-error-msg">동화 생성에 실패했습니다.</p>
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

  if (missingStoryError || error || !currentPreviewPage) {
    return (
      <div className="cr-shell">
        <CreationDoodlesBg />
        <CreationHeader currentStep={8} />
        <div className="cr-scroll">
          <main className="cr-shell-inner cr-fade-in cr-final-status">
            <div className="cr-final-status-inner">
              <p className="cr-final-status-text">
                {missingStoryError ?? error ?? '씬 데이터가 없습니다. 이전 단계를 확인해주세요.'}
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const regenLimit = regenStatus?.limit ?? REGEN_LIMIT_TOTAL
  const remaining = regenStatus?.remaining ?? REGEN_LIMIT_TOTAL
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
            subtitle={`마지막으로 펼쳐보세요. 마음에 안 드는 삽화는 전체 ${regenLimit}번까지 다시 그릴 수 있어요.`}
          />

          {/* 동화 단위 재생성 카운터 — Step 4 스토리보드 페이지의 우측 상단 pill 과 동일 톤. */}
          {regenStatus && (
            <div className="flex justify-end mb-4">
              <span
                className={`inline-flex items-center gap-1.5 font-bold text-base px-3 py-1.5 rounded-full border-2 shadow-sm ${
                  remaining > 0
                    ? 'bg-[#E9DBBE] border-[#9A7548]/50 text-[#6B4A28]'
                    : 'bg-[#F8C8C7] border-[#a3413f] text-[#a3413f]'
                }`}
                title={
                  remaining > 0
                    ? '이 동화에서 그림을 다시 그릴 수 있는 횟수예요.'
                    : '재생성 한도에 도달했어요. 더는 재생성할 수 없어요.'
                }
              >
                <RefreshCw className="w-3.5 h-3.5" />
                그림 재생성 {regenStatus.used} / {regenLimit}
              </span>
            </div>
          )}

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
                  ? `Cover / ${bodyPageCount}`
                  : `Page ${resultPageIndex + (coverScene ? 0 : 1)} / ${bodyPageCount}`}
              </span>
            </div>

            {currentSceneId !== null && (
              <div className="cr-final-regen-bar">
                <button
                  type="button"
                  className="cr-final-regen-trigger"
                  onClick={() => handleOpenPrompt(currentSceneId)}
                  disabled={!canRegen || isPanelOpen}
                >
                  <Wand2 className="w-4 h-4" />
                  {remaining > 0 ? '이 페이지 삽화 다시 그리기' : '더 이상 다시 그릴 수 없어요'}
                </button>
                {/* 재생성 횟수 안내는 상단 카운터 pill 로 이전됨 — 여기 글 형식은 제거. */}

                <FinalIllustrationVersionPicker
                  data={versionInfo}
                  disabled={isAnyRegenPending || versionLoading}
                  onChange={handleSelectVersion}
                />

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
        onNext={() => setShowPublishConfirm(true)}
        nextLabel="발행하기"
        nextDisabled={isAnyRegenPending}
      />

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

function FinalIllustrationVersionPicker({
  data,
  disabled,
  onChange,
}: {
  data: IllustrationVersionsResponse | null
  disabled: boolean
  onChange: (version: number) => void
}) {
  if (!data || data.versions.length <= 1) return null

  const sorted: IllustrationVersionEntry[] = [...data.versions].sort(
    (a, b) => b.version - a.version,
  )
  const currentValue = data.current ?? sorted[0].version

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = parseInt(event.target.value, 10)
    if (!Number.isFinite(next) || next === currentValue) return
    onChange(next)
  }

  const formatLabel = (entry: IllustrationVersionEntry): string => {
    if (entry.version === 1) return '초기 생성'
    const trimmed = entry.prompt?.trim()
    if (!trimmed) return '(설명 없음)'
    return trimmed.length > 18 ? `${trimmed.slice(0, 18)}...` : trimmed
  }

  return (
    <div className="flex items-center gap-1.5">
      <label
        className="text-[#3F6B2E] font-bold text-sm inline-flex items-center gap-1.5"
        htmlFor={`final-illustration-version-picker-${data.sceneId}`}
      >
        <History className="w-3.5 h-3.5" /> 이전 버전
      </label>
      <select
        id={`final-illustration-version-picker-${data.sceneId}`}
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        className="flex-1 pl-2.5 pr-9 py-1.5 rounded-lg border border-[#9A7548]/40 bg-[#F4E4BC]/60 text-sm text-[#3E2A18] focus:border-[#3F6B2E] focus:bg-[#F4E4BC]/85 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={`최종 삽화 ${data.sceneId} 버전 선택`}
        style={{
          appearance: 'none',
          // native 화살표 대신 커스텀 SVG — 우측 가장자리에서 12px 띄움 (step 4 picker 와 동일).
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1 L6 6 L11 1' stroke='%236b5638' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
        }}
      >
        {sorted.map(entry => (
          <option key={entry.version} value={entry.version}>
            {formatLabel(entry)}
          </option>
        ))}
      </select>
    </div>
  )
}
