import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react'
import type { StoryProject } from '../../model/types'
import { useStoryboardPagesQuery } from '../../storyboard-pages'
import { useGenerateStoryboardStoryPost } from '../model/useGenerateStoryboardStoryPost'
import { useGenerationJobQuery } from '../model/useGenerationJobQuery'

interface PromptStepProps {
  storyId: number | null
  data: StoryProject['step3']
  /**
   * SUCCESS 시점에 한 번 — sessionStorage 보관용 step3.story 동기화.
   * Step 3 자체에서 직접 텍스트 편집은 더 이상 일어나지 않는다 (옵션 D — 책임 분리).
   */
  onStoryChange: (story: string) => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 03 — "스토리(줄거리) 확정"
 *
 * 옵션 D 적용 후 책임:
 *  - 통합 한글 본문을 **read-only** 로 보여주기 (storyboard_pages 의 koreanText join)
 *  - 마음에 안 들면 AI 재생성 (POST /storyboard/story) 호출
 *  - "스토리 확정하고 다음" → Step 4 로 이동 (페이지별 글·그림 다듬기는 Step 4 의 책임)
 *
 * UI 모드:
 *  - INPUT   : 최초 프롬프트 입력 + "스토리 만들기" (POST 호출)
 *  - LOADING : Job polling 중
 *  - FAIL    : 실패 메시지 + "다시 시도"
 *  - RESULT  : 통합 한글본 read-only 표시 + AI 재요청 입력
 *
 * 데이터 source:
 *  - `useStoryboardPagesQuery(storyId)` 의 `pages[].koreanText` 를 `\n\n` 으로 join.
 *    Step 4 에서 페이지별 PATCH 한 결과가 자동 반영된다.
 *  - 캐시 미스 / 줄거리 미생성 상태에선 `data.story` (sessionStorage 복구값) 으로 fallback.
 */
export function PromptStep({ storyId, data, onStoryChange, onBack, onNext }: PromptStepProps) {
  const [prompt, setPrompt] = useState('')
  const [jobId, setJobId] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const generateMut = useGenerateStoryboardStoryPost(storyId)
  const jobQuery = useGenerationJobQuery(jobId)
  const pagesQuery = useStoryboardPagesQuery(storyId)

  // pages → 통합 한글 본문. Step 4 에서 PATCH 한 수정본이 자동 반영된다.
  const koreanBodyFromPages = useMemo(() => {
    const pages = pagesQuery.data?.pages ?? []
    if (pages.length === 0) return ''
    return pages
      .slice()
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map(p => (p.koreanText ?? '').trim())
      .filter(t => t.length > 0)
      .join('\n\n')
  }, [pagesQuery.data])

  // 화면 표시용 본문 — pages 가 있으면 그것이 진실, 없으면 sessionStorage 복구값으로 fallback.
  const displayBody = koreanBodyFromPages.length > 0 ? koreanBodyFromPages : data.story

  // Job SUCCESS 도달 시점에 한 번만 실행되도록 의존성을 좁힌다.
  //  - status 만 의존성에 두면 "PENDING/RUNNING → SUCCESS" 1회 transition 에서만 트리거됨.
  //  - jobQuery.data 통째로 두면 React Query 의 background refetch 마다 ref 가 바뀌어
  //    invalidateQueries 가 반복 호출될 위험이 있어 분리.
  //  - onStoryChange / queryClient 는 안정적인 ref (각각 useCallback / context) 라 deps 에서 제외.
  useEffect(() => {
    if (jobQuery.data?.status !== 'SUCCESS') return
    const payload = jobQuery.data.resultPayload
    if (!payload || storyId === null) return

    const koreanBody =
      payload.pages
        .slice()
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .map(p => p.koreanText.trim())
        .filter(t => t.length > 0)
        .join('\n\n') || payload.synopsis
    onStoryChange(koreanBody)
    void queryClient.invalidateQueries({ queryKey: ['storyboard-pages', storyId] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobQuery.data?.status, storyId])

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
   * Result 모드 (통합본 read-only + 재요청) 진입 조건:
   *  1) 방금 생성이 SUCCESS 로 돌아왔을 때
   *  2) 새로고침 후 storyId 가 복구돼 페이지 데이터가 이미 서버에 있을 때
   *     (`pagesQuery.data.pages.length > 0`)
   *  3) sessionStorage 에 step3.story 가 남아있을 때 (캐시 미도착 케이스의 fallback)
   */
  const hasGenerated = status === 'SUCCESS' && !!jobQuery.data?.resultPayload
  const hasServerPages = (pagesQuery.data?.pages.length ?? 0) > 0
  const hasRestoredStory = jobId === null && storyId !== null && data.story.trim().length > 0
  const hasResult = hasGenerated || hasServerPages || hasRestoredStory

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
                  ? '전체적인 흐름이 마음에 드시나요? 마음에 안 들면 AI 에게 다시 부탁할 수 있고, 페이지별 세부 내용은 다음 단계에서 다듬을 수 있어요.'
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
                synopsis={displayBody}
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
 * 결과 섹션 = 통합 한글본 read-only 표시 + AI 재요청 입력.
 *
 * 옵션 D 적용:
 *  - 직접 텍스트 편집 X — Step 4 에서 페이지별로 다듬는다.
 *  - "AI 에게 다시 요청" 버튼만 활성. 결과는 새 STORY job 으로 들어와 storyboard_pages 갈아끼움.
 */
function ResultSection(props: {
  synopsis: string
  onRegenerate: (prompt: string) => void
  regenerating: boolean
}) {
  const { synopsis, onRegenerate, regenerating } = props

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
      {/* 본문 read-only 표시 */}
      <div className="p-6 md:p-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl text-[#2d5a27] flex items-center gap-2 font-bold">
            <BookOpenCheck className="w-7 h-7" />
            동화책 줄거리
          </h2>
          <span className="text-[#8b7a52] font-sans text-sm">약 {synopsis.length}자</span>
        </div>

        {/* whitespace-pre-wrap 으로 \n\n 단락이 화면에서도 단락으로 보이게 한다. */}
        <div className="w-full min-h-[16rem] p-6 rounded-2xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] text-lg leading-relaxed font-sans whitespace-pre-wrap">
          {synopsis || '줄거리를 불러오는 중이에요...'}
        </div>
        <p className="mt-3 text-[#8b7a52] text-sm">
          페이지별 세부 내용은 다음 단계(스토리보드)에서 다듬을 수 있어요.
        </p>
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
