import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  Loader2,
  Lock,
  RotateCcw,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { isApiError } from '../../../../shared/api'
import type { StoryProject } from '../../model/types'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
import { StepTitleBlock } from '../../ui/StepTitleBlock'
import { useStoryboardPagesQuery } from '../../storyboard-pages'
import { useGenerateStoryboardStoryPost } from '../model/useGenerateStoryboardStoryPost'
import { useGenerateSummary } from '../model/useGenerateSummary'
import { useRegenerateSummary } from '../model/useRegenerateSummary'
import { useStoryboardStateQuery } from '../model/useStoryboardStateQuery'
import { useStoryboardSummaryPatch } from '../model/useStoryboardSummaryPatch'
import { useStoryboardSummaryQuery } from '../model/useStoryboardSummaryQuery'
import '../../styles/creation-paper.css'

const PROMPT_MAX_LENGTH = 1000

interface PromptStepProps {
  storyId: number | null
  data: StoryProject['step3']
  onStoryChange: (story: string) => void
  onStoryJobStarted: (jobId: number) => void
  lastConfirmedSummaryJobId: string | null
  onSummaryConfirmed: (summaryJobId: string | null) => void
  readOnly?: boolean
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 03 — paper-craft 톤 (Claude offline.html 1:1).
 *
 * 4-state in-place: INPUT / LOADING / FAIL / RESULT.
 * 모든 React Query / mutation / lock 로직 그대로 유지하고 마크업/스타일만 갈아엎음.
 */
export function PromptStep({
  storyId,
  data,
  onStoryChange,
  onStoryJobStarted,
  lastConfirmedSummaryJobId,
  onSummaryConfirmed,
  readOnly = false,
  onBack,
  onNext,
}: PromptStepProps) {
  const [prompt, setPrompt] = useState('')

  const summaryQuery = useStoryboardSummaryQuery(storyId)
  const generateMut = useGenerateSummary(storyId)
  const regenerateMut = useRegenerateSummary(storyId)
  const publishStoryMut = useGenerateStoryboardStoryPost(storyId)
  const summaryPatchMut = useStoryboardSummaryPatch(storyId)
  const pagesQuery = useStoryboardPagesQuery(storyId)
  const hasGeneratedPages = (pagesQuery.data?.pages?.length ?? 0) > 0

  const stateQuery = useStoryboardStateQuery(storyId)
  const hasActiveOrCompletedStoryJob =
    stateQuery.data?.activeJob != null || stateQuery.data?.latestFinalStatus === 'SUCCESS'

  const summary = summaryQuery.data
  const status = summary?.jobStatus ?? null
  const summaryKo = summary?.summaryKo ?? null

  const lastSyncedSummary = useMemo(() => {
    if (status === 'SUCCESS' && summaryKo && summaryKo !== data.story) {
      onStoryChange(summaryKo)
    }
    return summaryKo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, summaryKo])
  void lastSyncedSummary

  const triggerGenerate = useCallback(async () => {
    try {
      await generateMut.mutateAsync({ prompt: prompt.trim() || null })
    } catch {
      /* ApiError 는 UI 에서 표시 */
    }
  }, [generateMut, prompt])

  const triggerRegenerate = useCallback(
    async (userPrompt: string) => {
      const trimmed = userPrompt.trim()
      if (trimmed.length === 0) return
      try {
        await regenerateMut.mutateAsync({ userPrompt: trimmed })
      } catch (err) {
        if (isApiError(err) && err.code === 'STORY_012' && summary?.jobId) {
          onSummaryConfirmed(summary.jobId)
        }
      }
    },
    [regenerateMut, summary?.jobId, onSummaryConfirmed],
  )

  const retryAfterFail = useCallback(async () => {
    generateMut.reset()
    regenerateMut.reset()
    summaryQuery.resetTimeout()
    const refetched = await summaryQuery.refetch()
    const refreshedStatus = refetched.data?.jobStatus
    if (refreshedStatus === 'SUCCESS' || refreshedStatus === 'PENDING' || refreshedStatus === 'RUNNING') {
      return
    }
    void triggerGenerate()
  }, [generateMut, regenerateMut, summaryQuery, triggerGenerate])

  const hasMatchingConfirmedJob =
    lastConfirmedSummaryJobId !== null &&
    summary?.jobId !== undefined &&
    lastConfirmedSummaryJobId === summary.jobId
  const isLocked = readOnly || hasGeneratedPages || hasActiveOrCompletedStoryJob || hasMatchingConfirmedJob

  const handleConfirmAndNext = useCallback(async () => {
    const currentSummaryJobId = summary?.jobId ?? null
    try {
      const result = await publishStoryMut.mutateAsync({ prompt: null })
      onStoryJobStarted(result.jobId)
      onSummaryConfirmed(currentSummaryJobId)
      onNext()
    } catch (error) {
      if (isApiError(error) && error.code === 'STORY_012') {
        onSummaryConfirmed(currentSummaryJobId)
        onNext()
      }
    }
  }, [summary?.jobId, onNext, onStoryJobStarted, onSummaryConfirmed, publishStoryMut])

  const isNavigatingRef = useRef(false)

  const handleMainButtonClick = useCallback(async () => {
    if (isNavigatingRef.current) return
    isNavigatingRef.current = true
    try {
      if (isLocked) {
        onNext()
        return
      }
      await handleConfirmAndNext()
    } finally {
      isNavigatingRef.current = false
    }
  }, [isLocked, onNext, handleConfirmAndNext])

  const isGenerating = generateMut.isPending || regenerateMut.isPending
  const isLoading =
    isGenerating ||
    ((status === 'PENDING' || status === 'RUNNING') && !summaryQuery.isTimedOut)
  const hasResult = status === 'SUCCESS' && !!summaryKo
  const hasFailed =
    !isLoading &&
    (status === 'FAILED' ||
      generateMut.isError ||
      regenerateMut.isError ||
      summaryQuery.isTimedOut)

  const failureMessage = summaryQuery.isTimedOut
    ? 'AI 응답이 오래 지연되고 있어요. 잠시 후 다시 시도해 주세요.'
    : mapErrorMessage(generateMut.error) ??
      mapErrorMessage(regenerateMut.error) ??
      '생성에 실패했어요. 잠시 후 다시 시도해 주세요.'

  const publishError = mapErrorMessage(publishStoryMut.error)
  const isPublishing = publishStoryMut.isPending

  const showInput = !hasResult && !isLoading && !hasFailed

  return (
    <div className="cr-shell">
      <CreationDoodlesBg />
      <CreationHeader currentStep={3} />

      <div className="cr-scroll">
        <main className="cr-shell-inner cr-fade-in">
          <StepTitleBlock
            stepNumber={3}
            title={hasResult ? '우리 가족의 줄거리' : '어떤 이야기로 만들까요?'}
            subtitle={
              hasResult
                ? '마음에 드시면 확정해서 본문으로 넘어갈 수 있어요. 아니면 AI 에게 다시 부탁할 수 있어요'
                : '원하는 분위기나 주제를 자유롭게 적어주세요. 비워도 업로드한 사진·여행 정보만으로 만들 수 있어요'
            }
          />

          {/* 락 안내 — step 1/2 와 동일한 노란 cr-banner 톤. 본문 작업이 시작되어 줄거리 변경 불가. */}
          {isLocked && (
            <div className="cr-banner" role="status">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <strong>줄거리가 확정되어 이 단계는 읽기 전용이에요.</strong>
                <span style={{ fontSize: 18, opacity: 0.9 }}>
                  줄거리를 바꾸려면 새 동화책을 만들어주세요. 다음 단계로 넘어가면 본문/이미지를 이어 작업할 수 있어요.
                </span>
              </div>
            </div>
          )}

          {showInput && (
            <PromptInputCard
              prompt={prompt}
              onPromptChange={setPrompt}
              onGenerate={() => void triggerGenerate()}
              disabled={storyId === null}
            />
          )}

          {isLoading && <LoadingCard status={status} regenerating={regenerateMut.isPending} />}

          {hasFailed && <FailureCard message={failureMessage} onRetry={retryAfterFail} />}

          {hasResult && summaryKo && (
            <ResultSection
              summary={summaryKo}
              onRegenerate={triggerRegenerate}
              regenerating={regenerateMut.isPending}
              locked={isLocked}
              onSummaryEdit={summaryKoEdited => {
                const trimmed = summaryKoEdited.trim()
                if (trimmed.length === 0) return
                if (trimmed === summaryKo) return
                summaryPatchMut.mutate(
                  { summaryKo: trimmed },
                  {
                    onError: err => {
                      if (isApiError(err) && err.code === 'STORY_012' && summary?.jobId) {
                        onSummaryConfirmed(summary.jobId)
                      }
                    },
                  },
                )
              }}
              editPending={summaryPatchMut.isPending}
            />
          )}

          {publishError && (
            <p
              style={{
                marginTop: 16,
                color: 'var(--cr-rust)',
                fontFamily: 'var(--cr-font-gaegu)',
                fontSize: 17,
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              {publishError}
            </p>
          )}
        </main>
      </div>

      <CreationFooter
        currentStep={3}
        onBack={onBack}
        rightSlot={
          <button
            type="button"
            onClick={handleMainButtonClick}
            disabled={!hasResult || isPublishing}
            className="cr-btn-next"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>본문 준비 중</span>
              </>
            ) : isLocked ? (
              <>
                <span>스토리보드 생성하기</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>스토리 확인하러 가기</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        }
      />
    </div>
  )
}

function mapErrorMessage(error: unknown): string | null {
  if (error === null || error === undefined) return null
  if (!isApiError(error)) return error instanceof Error ? error.message : null
  switch (error.code) {
    case 'STORY_010':
      return '줄거리(요약) 생성을 먼저 완료해야 합니다.'
    case 'STORY_011':
      return '재생성할 직전 줄거리(요약)가 없습니다.'
    case 'STORY_012':
      return '본문 생성이 이미 진행 중입니다.'
    default:
      return error.message
  }
}

/* ============================================================================
 * INPUT 카드 — paper-craft cr-prompt-card.
 * ========================================================================= */
function PromptInputCard(props: {
  prompt: string
  onPromptChange: (v: string) => void
  onGenerate: () => void
  disabled: boolean
}) {
  const { prompt, onPromptChange, onGenerate, disabled } = props
  return (
    <div className="cr-card cr-prompt-card">
      <span className="cr-tape" aria-hidden="true" />
      <div className="field-head">
        <span className="ico" aria-hidden="true">
          <Wand2 className="w-3.5 h-3.5" />
        </span>
        <span className="ttl">이런 이야기로 만들어주세요</span>
        <span className="opt">선택</span>
      </div>
      <textarea
        value={prompt}
        onChange={e => onPromptChange(e.target.value)}
        placeholder={
          '예) "제주도에서의 따뜻한 가족 여행 분위기로 만들어주세요"\n예) "아이가 섬에서 모험처럼 떠나요"'
        }
        className="cr-prompt-textarea"
        maxLength={PROMPT_MAX_LENGTH}
      />
      <div className="cr-char-count">
        <span>{prompt.length}</span> / {PROMPT_MAX_LENGTH}
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled}
        className="cr-big-cta"
      >
        <Sparkles className="w-5 h-5" />
        <span>스토리 만들기 시작</span>
        <Send className="w-4 h-4" />
      </button>
    </div>
  )
}

/* LOADING 카드 */
function LoadingCard({
  status,
  regenerating,
}: {
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | null
  regenerating: boolean
}) {
  const hint = regenerating
    ? 'AI 가 새 줄거리를 만들고 있어요...'
    : status === 'RUNNING'
      ? 'AI 가 줄거리를 만들고 있어요...'
      : '작업을 시작하고 있어요...'
  return (
    <div className="cr-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
      <span className="cr-tape" aria-hidden="true" />
      <Loader2
        className="w-12 h-12 animate-spin"
        style={{ color: 'var(--cr-sage-deep)', margin: '0 auto 16px' }}
      />
      <h2
        style={{
          fontFamily: 'var(--cr-font-serif)',
          fontWeight: 800,
          fontSize: 24,
          color: 'var(--cr-ink)',
          margin: '0 0 6px',
        }}
      >
        {hint}
      </h2>
      <p style={{ fontFamily: 'var(--cr-font-gaegu)', color: 'var(--cr-ink-soft)', margin: 0 }}>
        잠시만 기다려주세요.
      </p>
    </div>
  )
}

/* FAIL 카드 */
function FailureCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="cr-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
      <span className="cr-tape" aria-hidden="true" />
      <h2
        style={{
          fontFamily: 'var(--cr-font-serif)',
          fontWeight: 800,
          fontSize: 24,
          color: 'var(--cr-rust)',
          margin: '0 0 8px',
        }}
      >
        앗, 생성에 실패했어요
      </h2>
      <p
        style={{
          fontFamily: 'var(--cr-font-gaegu)',
          color: 'var(--cr-ink-soft)',
          margin: '0 0 18px',
          fontSize: 18,
        }}
      >
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="cr-btn-next"
        style={{ justifySelf: 'center' }}
      >
        <RotateCcw className="w-4 h-4" />
        <span>다시 시도하기</span>
      </button>
    </div>
  )
}

/* RESULT 섹션 */
function ResultSection(props: {
  summary: string
  onRegenerate: (userPrompt: string) => void
  regenerating: boolean
  locked: boolean
  onSummaryEdit: (next: string) => void
  editPending: boolean
}) {
  const { summary, onRegenerate, regenerating, locked, onSummaryEdit, editPending } = props
  const [refinePrompt, setRefinePrompt] = useState('')

  const [draft, setDraft] = useState(summary)
  const lastSyncedRef = useRef(summary)
  if (summary !== lastSyncedRef.current && draft === lastSyncedRef.current) {
    lastSyncedRef.current = summary
    setDraft(summary)
  }

  const handleRegenerate = useCallback(() => {
    if (refinePrompt.trim().length === 0) return
    onRegenerate(refinePrompt)
    setRefinePrompt('')
  }, [onRegenerate, refinePrompt])

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRegenerate()
    }
  }

  return (
    <div className="cr-card cr-prompt-card">
      <span className="cr-tape" aria-hidden="true" />
      <div className="field-head">
        <span className="ico" aria-hidden="true">
          <BookOpenCheck className="w-3.5 h-3.5" />
        </span>
        <span className="ttl">동화책 줄거리</span>
        <span className="opt">
          {editPending ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin inline-block mr-1" />
              저장 중
            </>
          ) : (
            `약 ${draft.length}자`
          )}
        </span>
      </div>

      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => onSummaryEdit(draft)}
        disabled={locked}
        maxLength={4000}
        className="cr-prompt-textarea"
      />
      {/* locked 안내는 상단 cr-banner 로 이전됨 — 여기서는 편집 가능한 상태일 때만 안내 표시. */}
      {!locked && (
        <p
          style={{
            marginTop: 8,
            fontFamily: 'var(--cr-font-gaegu)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--cr-sage-deep)',
          }}
        >
          표현이나 단어를 직접 다듬을 수 있어요. 큰 의미 변경(여행지/등장인물 등)은 아래 "AI 에게 다시 요청하기" 가 더 정확해요.
        </p>
      )}

      {locked ? null : (
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontFamily: 'var(--cr-font-serif)',
              fontWeight: 800,
              fontSize: 20,
              color: 'var(--cr-ink)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Wand2 className="w-4 h-4" style={{ color: 'var(--cr-caramel-deep)' }} />
            AI 에게 다시 요청하기
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={refinePrompt}
              onChange={e => setRefinePrompt(e.target.value)}
              onKeyDown={onKey}
              type="text"
              placeholder="예: '조금 더 감동적인 말투로 바꿔줘', '아이의 시점에서 일기처럼 써줘'"
              className="cr-input"
              disabled={regenerating}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating || refinePrompt.trim().length === 0}
              className="cr-btn-next"
              style={{ justifySelf: 'auto', flexShrink: 0 }}
            >
              {regenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>생성 중</span>
                </>
              ) : (
                <>
                  <span>요청</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
          <p
            style={{
              marginTop: 8,
              fontFamily: 'var(--cr-font-gaegu)',
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--cr-sage-deep)',
            }}
          >
            재요청 시 기존 줄거리는 새 결과로 교체됩니다.
          </p>
        </div>
      )}
    </div>
  )
}
