import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react'
import type { StoryProject } from '../../model/types'
import { useGenerateStoryboardStoryPost } from '../model/useGenerateStoryboardStoryPost'
import { useGenerationJobQuery } from '../model/useGenerationJobQuery'
import { useStoryboardStoryPatch } from '../model/useStoryboardStoryPatch'

interface PromptStepProps {
  storyId: number | null
  data: StoryProject['step3']
  onStoryChange: (story: string) => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 03 — "스토리(줄거리) 생성 & 편집"
 *
 * UI 상태:
 *  - INPUT   : 최초 프롬프트 입력 + "스토리 만들기" (POST 호출)
 *  - LOADING : Job polling 중
 *  - FAIL    : 실패 메시지 + "다시 시도"
 *  - RESULT  : synopsis textarea 편집(onBlur PATCH 자동 저장)
 *              + "프롬프트로 재요청" (POST 재호출)
 *              + "확정하기" (onNext → Step 4)
 *
 * 관련 명세:
 *  - POST /storyboard/story  (#28)   — 생성 트리거
 *  - GET  /generation-jobs   (#56)   — 상태 polling
 *  - PATCH /storyboard/story (#29)   — 유저 편집 저장
 */
export function PromptStep({ storyId, data, onStoryChange, onBack, onNext }: PromptStepProps) {
  const [prompt, setPrompt] = useState('')
  const [jobId, setJobId] = useState<number | null>(null)

  const generateMut = useGenerateStoryboardStoryPost(storyId)
  const jobQuery = useGenerationJobQuery(jobId)
  const patchMut = useStoryboardStoryPatch(storyId)

  // 생성 결과 도착 시 한 번만 step3.story 에 한글 본문을 반영한다.
  // AI 의 `synopsis` 는 영문 요약이라 유저에게 부적합 — pages[].koreanText 를 단락 단위로
  // 이어붙인 한글 본문을 노출한다. BE Listener 가 저장하는 값과 동일한 규칙.
  // 이후 사용자가 편집한 값은 data.story 에 덮여 살아있고, onBlur 에서 PATCH 로 서버에도 반영.
  useEffect(() => {
    if (jobQuery.data?.status === 'SUCCESS' && jobQuery.data.resultPayload) {
      const payload = jobQuery.data.resultPayload
      const koreanBody =
        payload.pages
          .slice()
          .sort((a, b) => a.pageNumber - b.pageNumber)
          .map(p => p.koreanText.trim())
          .filter(t => t.length > 0)
          .join('\n\n') || payload.synopsis
      onStoryChange(koreanBody)
    }
  }, [jobQuery.data, onStoryChange])

  const triggerGenerate = useCallback(
    async (promptText?: string) => {
      try {
        const body = { prompt: (promptText ?? prompt).trim() || null }
        const res = await generateMut.mutateAsync(body)
        setJobId(res.jobId)
      } catch {
        /* ApiError 는 UI 에서 표시 */
      }
    },
    [generateMut, prompt],
  )

  const retryAfterFail = useCallback(() => {
    setJobId(null)
    generateMut.reset()
  }, [generateMut])

  const status = jobQuery.data?.status
  const isLoading =
    generateMut.isPending ||
    (jobId !== null &&
      !jobQuery.isTimedOut &&
      status !== 'SUCCESS' &&
      status !== 'FAILED' &&
      status !== 'CANCELLED')

  /**
   * 이 화면에서 Result 모드(편집 가능한 한글 본문 + 재요청)를 보여줄지 여부.
   * 두 가지 경로로 진입:
   *  1) 방금 생성이 SUCCESS 로 돌아왔을 때 (resultPayload 존재)
   *  2) 새로고침 후 storyId + data.story 가 복구돼 있어 서버에 이미 저장된 스토리가 있을 때
   *     (이 경우 jobId 없이도 Result 모드 시작 — 텍스트는 복구된 data.story 사용)
   */
  const hasGenerated = status === 'SUCCESS' && !!jobQuery.data?.resultPayload
  const hasRestoredStory = jobId === null && storyId !== null && data.story.trim().length > 0
  const hasResult = hasGenerated || hasRestoredStory
  const hasFailed =
    status === 'FAILED' ||
    status === 'CANCELLED' ||
    generateMut.isError ||
    jobQuery.isTimedOut
  const failureMessage = jobQuery.isTimedOut
    ? 'AI 응답이 오래 지연되고 있어요. 잠시 후 다시 시도해 주세요.'
    : jobQuery.data?.errorMessage ??
      generateMut.error?.message ??
      '생성에 실패했어요. 잠시 후 다시 시도해 주세요.'

  return (
    <div className="bookshelf-modal step-forest-modal">
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
          <span className="text-[#b4c4a4] text-sm font-bold tracking-wider">STEP 03 / 08</span>
          <span className="bookshelf-title-display text-2xl text-[#f0e6c0] font-bold">스토리 만들기</span>
        </div>
      </div>

      <div className="bookshelf-scroll">
        <main className="py-10 px-6 bookshelf-fade-in">
          <div className="max-w-3xl mx-auto pb-12">
            {/* 타이틀 */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-[#2d5a27]/60 px-4 py-1.5 rounded-full border border-[#b4dc8c]/50 mb-4 shadow-sm">
                <Sparkles className="w-4 h-4 text-[#b4dc8c]" />
                <span className="text-[#b4dc8c] text-sm font-bold">
                  {hasResult ? 'AI 가 이야기를 만들었어요' : 'AI 에게 부탁해 볼까요?'}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl text-[#f0e6c0] mb-3 font-bold">
                {hasResult ? '우리 가족의 특별한 줄거리' : '어떤 이야기로 만들까요?'}
              </h1>
              <p className="text-[#b4c4a4] text-lg">
                {hasResult
                  ? '전체적인 흐름이 마음에 드시나요? 내용을 직접 수정하거나 AI 에게 다시 부탁할 수 있어요.'
                  : '원하는 분위기나 주제를 자유롭게 적어주세요. 비워도 업로드하신 사진·여행 정보만으로 만들 수 있어요.'}
              </p>
            </div>

            {!hasResult && !isLoading && !hasFailed && (
              <PromptInputCard
                prompt={prompt}
                onPromptChange={setPrompt}
                onGenerate={() => void triggerGenerate()}
                disabled={storyId === null}
              />
            )}

            {isLoading && <LoadingCard status={status ?? 'PENDING'} />}

            {hasFailed && !isLoading && (
              <FailureCard message={failureMessage} onRetry={retryAfterFail} />
            )}

            {hasResult && (
              <ResultSection
                synopsis={data.story}
                onSynopsisChange={onStoryChange}
                onPatch={async value => {
                  const trimmed = value.trim()
                  if (trimmed.length === 0) return
                  try {
                    await patchMut.mutateAsync({ story: trimmed })
                  } catch {
                    /* 에러는 patchMut.error 로 표시 */
                  }
                }}
                patchPending={patchMut.isPending}
                patchError={patchMut.error?.message ?? null}
                onRegenerate={newPrompt => {
                  setJobId(null)
                  generateMut.reset()
                  void triggerGenerate(newPrompt)
                }}
                regenerating={generateMut.isPending}
              />
            )}

            {/* 하단 액션 */}
            <div className="flex justify-between items-center pt-6 mt-8 border-t border-[#4a3a24]">
              <button
                type="button"
                onClick={onBack}
                className="text-[#b4c4a4] hover:text-[#f0e6c0] px-4 py-2 text-lg font-bold transition-colors"
              >
                이전
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!hasResult}
                className="bg-[#2d5a27] text-[#f0e6c0] px-10 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.5)] hover:bg-[#3d6f34] transition-all font-bold flex items-center gap-2 text-xl whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                스토리 확정하고 다음 <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/** 최초 프롬프트 입력 + 생성 트리거. */
function PromptInputCard(props: {
  prompt: string
  onPromptChange: (v: string) => void
  onGenerate: () => void
  disabled: boolean
}) {
  const { prompt, onPromptChange, onGenerate, disabled } = props
  return (
    <div className="bg-[#f0e6c0] rounded-[2.5rem] border-2 border-[#2a1b12] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
      <div className="p-6 md:p-10">
        <label className="flex items-center gap-2 text-[#2d5a27] font-bold mb-3 text-xl">
          <Wand2 className="w-6 h-6" />
          이런 이야기로 만들어주세요 (선택)
        </label>
        <textarea
          value={prompt}
          onChange={e => onPromptChange(e.target.value)}
          placeholder={
            '예: "제주도에서의 따뜻한 가족 여행 분위기로 만들어주세요"\n예: "아이의 시점에서 모험처럼 써주세요"'
          }
          className="w-full h-48 p-6 rounded-2xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] text-lg leading-relaxed focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 focus:outline-none resize-none font-sans"
          maxLength={1000}
        />
        <div className="mt-2 text-right text-[#8b7a52] text-sm">{prompt.length} / 1000</div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={disabled}
          className="w-full mt-6 bg-[#2d5a27] text-[#f0e6c0] px-6 py-5 rounded-2xl font-bold hover:bg-[#3d6f34] border border-[#b4dc8c]/40 transition-colors flex items-center justify-center gap-3 shadow-[0_4px_0_#1a3a14] text-xl disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-6 h-6" />
          스토리 만들기 시작
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

function LoadingCard({ status }: { status: string }) {
  const hint = status === 'RUNNING' ? 'AI 가 이야기를 쓰고 있어요...' : '작업을 시작하고 있어요...'
  return (
    <div className="bg-[#f0e6c0] rounded-[2.5rem] border-2 border-[#2a1b12] shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-10 text-center">
      <Loader2 className="w-14 h-14 text-[#2d5a27] animate-spin mx-auto mb-6" />
      <h2 className="text-2xl text-[#2d5a27] font-bold mb-2">{hint}</h2>
      <p className="text-[#8b7a52]">보통 10~30초 정도 걸려요. 잠시만 기다려주세요.</p>
    </div>
  )
}

function FailureCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-[#f0e6c0] rounded-[2.5rem] border-2 border-[#2a1b12] shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-10 text-center">
      <h2 className="text-2xl text-[#7a2d27] font-bold mb-3">앗, 생성에 실패했어요</h2>
      <p className="text-[#5a3a27] mb-6">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-[#2d5a27] text-[#f0e6c0] px-6 py-3 rounded-xl font-bold hover:bg-[#3d6f34] border border-[#b4dc8c]/40 transition-colors inline-flex items-center gap-2 shadow-[0_4px_0_#1a3a14]"
      >
        <RotateCcw className="w-5 h-5" /> 다시 시도하기
      </button>
    </div>
  )
}

/**
 * 결과 섹션 = 편집 가능한 synopsis + AI 재요청 입력.
 *
 * - synopsis textarea 는 로컬 제어. blur 시 PATCH 자동 호출.
 * - 재요청 입력 + "요청" 버튼 → 부모에게 위임, 새 POST 트리거.
 */
function ResultSection(props: {
  synopsis: string
  onSynopsisChange: (v: string) => void
  onPatch: (v: string) => Promise<void> | void
  patchPending: boolean
  patchError: string | null
  onRegenerate: (prompt: string) => void
  regenerating: boolean
}) {
  const {
    synopsis,
    onSynopsisChange,
    onPatch,
    patchPending,
    patchError,
    onRegenerate,
    regenerating,
  } = props

  const [refinePrompt, setRefinePrompt] = useState('')

  const handleRegenerate = useCallback(() => {
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
    <div className="bg-[#f0e6c0] rounded-[2.5rem] border-2 border-[#2a1b12] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* 본문 편집 */}
      <div className="p-6 md:p-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl text-[#2d5a27] flex items-center gap-2 font-bold">
            <BookOpenCheck className="w-7 h-7" />
            동화책 줄거리
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#8b7a52] font-sans">약 {synopsis.length}자</span>
            {patchPending && (
              <span className="inline-flex items-center gap-1 text-[#8b7a52]">
                <Loader2 className="w-4 h-4 animate-spin" /> 저장 중
              </span>
            )}
            {!patchPending && !patchError && synopsis.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[#2d5a27]">
                <Check className="w-4 h-4" /> 저장됨
              </span>
            )}
          </div>
        </div>

        <textarea
          value={synopsis}
          onChange={e => onSynopsisChange(e.target.value)}
          onBlur={e => void onPatch(e.target.value)}
          className="w-full h-64 p-6 rounded-2xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] text-lg leading-relaxed focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 focus:outline-none resize-none font-sans"
        />
        <p className="mt-3 text-[#8b7a52] text-sm">
          내용을 직접 수정하실 수 있어요. 포커스를 빼면 자동으로 저장됩니다.
        </p>
        {patchError && <p className="mt-2 text-[#a3413f] text-sm">저장 실패: {patchError}</p>}
      </div>

      {/* AI 재요청 영역 */}
      <div className="bg-[#e8ddb4] p-6 md:p-8 border-t-2 border-[#8b7a52]/40">
        <label className="flex items-center gap-2 text-[#2d5a27] font-bold mb-3 text-lg">
          <Wand2 className="w-5 h-5" /> AI 에게 다시 요청하기
        </label>
        <div className="flex gap-2">
          <input
            value={refinePrompt}
            onChange={e => setRefinePrompt(e.target.value)}
            onKeyDown={onKey}
            type="text"
            placeholder="예: '조금 더 감동적인 말투로 바꿔줘', '아이의 시점에서 일기처럼 써줘'"
            className="flex-1 p-4 rounded-xl border-2 border-[#b4dc8c] bg-[#f0e6c0] focus:border-[#2d5a27] focus:outline-none text-lg font-sans text-[#2d5a27] placeholder-[#8b7a52]/60"
          />
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="bg-[#2d5a27] text-[#f0e6c0] px-6 py-4 rounded-xl font-bold hover:bg-[#3d6f34] border border-[#b4dc8c]/40 transition-colors flex items-center gap-2 shadow-[0_4px_0_#1a3a14] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {regenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> 생성 중
              </>
            ) : (
              <>
                요청 <Send className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
        <p className="mt-3 text-[#8b7a52] text-sm">
          재요청 시 기존 내용은 새로 생성된 내용으로 교체됩니다.
        </p>
      </div>
    </div>
  )
}
