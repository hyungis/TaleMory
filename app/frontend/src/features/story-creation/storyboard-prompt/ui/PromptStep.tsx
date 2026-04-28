import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react'
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
import { isApiError } from '../../../../shared/api'
import type { StoryProject } from '../../model/types'
import { useStoryboardPagesQuery } from '../../storyboard-pages'
import { useGenerateStoryboardStoryPost } from '../model/useGenerateStoryboardStoryPost'
import { useGenerateSummary } from '../model/useGenerateSummary'
import { useRegenerateSummary } from '../model/useRegenerateSummary'
import { useStoryboardSummaryPatch } from '../model/useStoryboardSummaryPatch'
import { useStoryboardSummaryQuery } from '../model/useStoryboardSummaryQuery'

interface PromptStepProps {
  storyId: number | null
  data: StoryProject['step3']
  /**
   * SUMMARY SUCCESS 시점에 sessionStorage 보관용 step3.story 동기화.
   * Step 4 진입 후의 본문 편집은 Step 4 의 책임 — Step 3 자체는 줄거리만 다룬다.
   */
  onStoryChange: (story: string) => void
  /**
   * 본문(STORY) 잡이 새로 발행됐을 때 부모 flow state 에 jobId 보관.
   * Step 4 가 그 jobId 로 폴링하여 PENDING/RUNNING 동안 "본문 생성 중" 화면 표시.
   * 409 (이미 진행 중) 케이스는 jobId 를 알 수 없어 호출하지 않음 — Step 4 는
   * storyboard-pages 캐시 fallback 경로로 동작.
   */
  onStoryJobStarted: (jobId: number) => void
  /**
   * 본문 발행이 한 번이라도 트리거된 적이 있으면 set (해당 SUMMARY 잡 id).
   * null 이 아니면 Step 3 은 read-only 잠금 상태 — 줄거리 재생성/확정 모두 막고
   * Step 4 로 navigate 만 허용. 본문 작업 중간에 줄거리가 바뀌면 페이지가 통째 교체되어
   * Step 4 의 편집 결과가 사라지는 사고를 봉인하기 위함.
   */
  lastConfirmedSummaryJobId: string | null
  /**
   * 본문 발행을 트리거한 직후, 그때 사용한 SUMMARY 잡 id 를 부모 flow 에 기록.
   * 이 값이 null 이 아니면 Step 3 은 잠금 상태가 됨.
   */
  onSummaryConfirmed: (summaryJobId: string | null) => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 03 — "스토리(줄거리) 만들기"
 *
 * 흐름 (4-state in-place):
 *  - INPUT   : 자유 프롬프트 입력 + "스토리 만들기 시작" → POST /storyboard/summary
 *  - LOADING : SUMMARY 잡 polling 중 (PENDING/RUNNING)
 *  - FAIL    : SUMMARY 잡 FAILED / 타임아웃 / 네트워크 → "다시 시도하기"
 *  - RESULT  : SUMMARY SUCCESS — summaryKo 표시
 *              - "다시 만들기" 자연어 input → POST /summary/regenerate
 *              - "스토리 확정하고 다음" → POST /storyboard/story (본문 발행) → Step 4 navigate
 *
 * 본문(STORY)/페이지 편집은 Step 4 의 책임. Step 3 은 오직 줄거리 확정 trigger 까지만.
 */
export function PromptStep({
  storyId,
  data,
  onStoryChange,
  onStoryJobStarted,
  lastConfirmedSummaryJobId,
  onSummaryConfirmed,
  onBack,
  onNext,
}: PromptStepProps) {
  const [prompt, setPrompt] = useState('')

  const summaryQuery = useStoryboardSummaryQuery(storyId)
  const generateMut = useGenerateSummary(storyId)
  const regenerateMut = useRegenerateSummary(storyId)
  // 본문(STORY) 발행은 Step 3 이 trigger 만 한다. Step 4 가 자체 polling.
  const publishStoryMut = useGenerateStoryboardStoryPost(storyId)
  // 줄거리 직접 편집 — onBlur 시 PATCH (옵션 ② 디자인).
  const summaryPatchMut = useStoryboardSummaryPatch(storyId)
  /**
   * 본문(STORY) 페이지 존재 여부 — BE 진실 기반 락의 1차 방어선.
   * 페이지가 한 장이라도 INSERT 되어 있으면 본문이 이미 생성된 것이므로 줄거리 변경 차단.
   * sessionStorage 의 lastConfirmedSummaryJobId 가 새로고침으로 풀려도 BE 데이터로 락 유지.
   */
  const pagesQuery = useStoryboardPagesQuery(storyId)
  const hasGeneratedPages = (pagesQuery.data?.pages?.length ?? 0) > 0

  const summary = summaryQuery.data
  const status = summary?.jobStatus ?? null
  const summaryKo = summary?.summaryKo ?? null

  // SUCCESS 시 sessionStorage 동기화 (data.story 가 변경 감지). 한 번만 동기화하기 위해 useMemo 로 의존 좁힘.
  // (parent useStoryCreationFlow 가 이 값을 받아 step3.story 로 저장하므로 새로고침 fallback 으로 사용 가능.)
  const lastSyncedSummary = useMemo(() => {
    if (status === 'SUCCESS' && summaryKo && summaryKo !== data.story) {
      onStoryChange(summaryKo)
    }
    return summaryKo
    // 의도적으로 status / summaryKo 만 의존. onStoryChange 는 안정 ref 가정.
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
      } catch {
        /* ApiError 는 UI 에서 표시 */
      }
    },
    [regenerateMut],
  )

  const retryAfterFail = useCallback(async () => {
    generateMut.reset()
    regenerateMut.reset()
    // 1) timeout deadlock 풀기 — polling enabled 로 되돌림.
    summaryQuery.resetTimeout()
    // 2) BE 가 timeout 동안 SUCCESS 했을 가능성 우선 확인 — 새 잡 만들지 않고 refetch.
    const refetched = await summaryQuery.refetch()
    const refreshedStatus = refetched.data?.jobStatus
    if (refreshedStatus === 'SUCCESS' || refreshedStatus === 'PENDING' || refreshedStatus === 'RUNNING') {
      // 이미 진행 중이거나 완료됨 → 새 잡 발행 불필요. UI 가 자동으로 LOADING/RESULT 화면 전환.
      return
    }
    // 3) BE 도 진짜로 비어있거나 FAILED → 새 SUMMARY 잡 만들기.
    void triggerGenerate()
  }, [generateMut, regenerateMut, summaryQuery, triggerGenerate])

  // Step 3 잠금 신호 — 본문이 한 번이라도 발행됐으면 줄거리 변경 봉인.
  // 두 갈래 중 하나라도 true 면 락:
  //  1) BE 진실: storyboard-pages 가 이미 INSERT 되어 있음 (본문 생성 완료/진행 후 page row 존재)
  //     → 새로고침을 거쳐도 BE 데이터로 즉시 복원되는 안정적 락.
  //  2) FE 메모리/스냅샷: 마지막 confirm 시점의 SUMMARY jobId 가 *현재 SUMMARY jobId 와 같음*.
  //     단순 non-null 이 아니라 jobId 동치 비교를 쓰는 이유:
  //      - sessionStorage 에 남은 옛 jobId 가 BE 데이터 초기화 / 재생성 후에도 살아남아
  //        무관한 SUMMARY 를 잠가버리는 사고 방지 (false-positive lock).
  //      - 사용자가 줄거리를 재생성하면 jobId 가 바뀌므로 자동으로 락 해제 → "재생성 후 한 번 더 확정"
  //        흐름이 자연스럽게 가능.
  const hasMatchingConfirmedJob =
    lastConfirmedSummaryJobId !== null &&
    summary?.jobId !== undefined &&
    lastConfirmedSummaryJobId === summary.jobId
  const isLocked = hasGeneratedPages || hasMatchingConfirmedJob

  const handleConfirmAndNext = useCallback(async () => {
    const currentSummaryJobId = summary?.jobId ?? null
    try {
      // 본문 발행 trigger. 응답의 jobId 를 부모 flow 에 보관해 Step 4 가 폴링.
      const result = await publishStoryMut.mutateAsync({ prompt: null })
      onStoryJobStarted(result.jobId)
      onSummaryConfirmed(currentSummaryJobId)
      onNext()
    } catch (error) {
      // STORY_010 STORY_ALREADY_IN_PROGRESS — 이미 본문 잡이 PENDING/RUNNING.
      if (isApiError(error) && error.code === 'STORY_010') {
        onSummaryConfirmed(currentSummaryJobId)
        onNext()
      }
      /* 기타 에러는 mutation.error 에서 표시 */
    }
  }, [
    summary?.jobId,
    onNext,
    onStoryJobStarted,
    onSummaryConfirmed,
    publishStoryMut,
  ])

  /**
   * 동기 ref 가드 — 빠른 더블/삼중 클릭이 publish 호출을 두 번 보내거나
   * `onNext()` 를 두 번 호출해 Step 5 로 건너뛰는 사고를 막는다.
   *
   * `publishStoryMut.isPending` 은 React commit-paint 가 끝난 다음 frame 에서야
   * button 의 `disabled` 로 반영되므로 16ms 이내 더블 클릭에는 무력하다.
   * useRef 는 동기 set 이라 같은 tick 안의 두 번째 클릭부터 즉시 차단된다.
   *
   * Step 4 → Step 3 재진입 시 컴포넌트가 remount 되어 ref 가 false 로 리셋되므로
   * "한 번 가드 걸린 채 박제됨" 같은 부작용은 없다.
   */
  const isNavigatingRef = useRef(false)

  /**
   * 하단 메인 버튼 클릭 핸들러. 잠금 여부에 따라 분기:
   *  - 미잠금: 본문 발행 + Step 4 navigate
   *  - 잠금: 단순 Step 4 navigate (이미 본문 잡 진행 중 / 완료됨)
   *
   * 양쪽 분기 모두 ref 가드로 한 클릭만 통과시킨다.
   */
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
      // 성공 경로에서는 PromptStep 이 unmount 되므로 이 라인은 의미가 없지만,
      // mutation 이 catch 외 에러로 throw 되거나 onNext 가 작동하지 않은 경우(예외)
      // 다음 클릭이 영구히 막히지 않도록 풀어준다.
      isNavigatingRef.current = false
    }
  }, [isLocked, onNext, handleConfirmAndNext])

  // 화면 분기 — null/SUCCESS/PENDING/RUNNING/FAILED 5 케이스 + mutation 진행 중.
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

  // 본문 발행 진행 중 / 에러 표시.
  const publishError = mapErrorMessage(publishStoryMut.error)
  const isPublishing = publishStoryMut.isPending

  // INPUT 모드 — 결과/로딩/실패가 모두 아닐 때.
  const showInput = !hasResult && !isLoading && !hasFailed

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
                  {hasResult ? '이런 이야기로 만들면 어때요?' : 'AI 에게 부탁해 볼까요?'}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl text-[#f0e6c0] mb-3 font-bold">
                {hasResult ? '우리 가족의 줄거리 미리보기' : '어떤 이야기로 만들까요?'}
              </h1>
              <p className="text-[#b4c4a4] text-lg">
                {hasResult
                  ? '마음에 드시면 확정해서 본격적인 동화책 본문으로 넘어갈 수 있어요. 아니면 AI 에게 다시 부탁할 수 있어요.'
                  : '원하는 분위기나 주제를 자유롭게 적어주세요. 비워도 업로드하신 사진·여행 정보만으로 만들 수 있어요.'}
              </p>
            </div>

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
                  // 빈 입력은 BE 가 거부하므로 호출 자체 skip — UI 상에서도 trim 후 비면 그냥 무시.
                  const trimmed = summaryKoEdited.trim()
                  if (trimmed.length === 0) return
                  if (trimmed === summaryKo) return
                  summaryPatchMut.mutate({ summaryKo: trimmed })
                }}
                editPending={summaryPatchMut.isPending}
              />
            )}

            {/* 본문 발행 에러 — 결과 카드 아래에 inline 으로 표시. */}
            {publishError && (
              <p className="mt-4 text-[#fca5a5] text-sm text-center">{publishError}</p>
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
                onClick={handleMainButtonClick}
                disabled={!hasResult || isPublishing}
                className="bg-[#2d5a27] text-[#f0e6c0] px-10 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.5)] hover:bg-[#3d6f34] transition-all font-bold flex items-center gap-2 text-xl whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> 본문 준비 중
                  </>
                ) : isLocked ? (
                  <>
                    본문으로 돌아가기 <ArrowRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    스토리 확정하고 다음 <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/** BE 에러 코드(STORY_008/009/010) 를 사용자 친화 메시지로 매핑. */
function mapErrorMessage(error: unknown): string | null {
  if (error === null || error === undefined) return null
  if (!isApiError(error)) return error instanceof Error ? error.message : null
  switch (error.code) {
    case 'STORY_008':
      return '줄거리(요약) 생성을 먼저 완료해야 합니다.'
    case 'STORY_009':
      return '재생성할 직전 줄거리(요약)가 없습니다.'
    case 'STORY_010':
      return '본문 생성이 이미 진행 중입니다.'
    default:
      return error.message
  }
}

/** 최초 프롬프트 입력 + 생성 trigger. */
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
 * RESULT 섹션 — 줄거리(요약) 직접 편집 + 자연어 재생성 입력 (옵션 ② 디자인).
 *
 * 직접 편집 정책:
 *  - 한글 줄거리 textarea 를 직접 편집할 수 있다 (작은 표현 다듬기 / 단어 교체 등).
 *  - onBlur 시 BE 에 PATCH — `stories.synopsis` / `story_board.story` /
 *    최신 SUMMARY 잡의 `result_payload.summaryKo` 세 곳에 sync.
 *  - 본문 발행 시 BE 가 이 한글을 `summary` (영문 자리) 와 `summaryKo` 양쪽에 복사 송신 →
 *    AI 가 한글을 ground 로 본문 생성 (영문/메타 mismatch 회피).
 *  - 큰 의미 변경(예: 여행지 자체 변경)은 영문/메타가 옛날 그대로라 본문에 잘 반영 안 됨 →
 *    하단 "AI 에게 다시 요청하기" 자연어 prompt 로 처리하도록 안내.
 *
 * `locked=true` 일 때 (= 본문 발행이 한 번이라도 트리거된 후):
 *  - textarea 비활성화. 자연어 재요청 입력도 숨기고 잠금 배너로 대체.
 */
function ResultSection(props: {
  summary: string
  onRegenerate: (userPrompt: string) => void
  regenerating: boolean
  locked: boolean
  /** 사용자가 textarea blur 시 호출. trim 된 결과가 기존과 같으면 호출자는 skip 권장. */
  onSummaryEdit: (next: string) => void
  /** PATCH 진행 중 여부 — '저장 중' 표시용. */
  editPending: boolean
}) {
  const { summary, onRegenerate, regenerating, locked, onSummaryEdit, editPending } = props

  const [refinePrompt, setRefinePrompt] = useState('')

  // 한글 줄거리 textarea local draft. BE source(summary prop)가 갱신되면 따라가지만,
  // 사용자가 편집 중이면 그 편집을 덮어쓰지 않도록 ref 로 마지막 동기화 시점만 추적한다.
  const [draft, setDraft] = useState(summary)
  const lastSyncedRef = useRef(summary)
  if (summary !== lastSyncedRef.current && draft === lastSyncedRef.current) {
    // BE 값이 바뀌었고, 사용자가 그 사이 편집한 흔적이 없으면(=draft===이전 BE값) 새 값으로 동기화.
    // 사용자가 편집 중(draft !== 이전 BE값)이면 BE 값이 바뀌어도 사용자의 편집 보존.
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
    <div className="bg-[#f0e6c0] rounded-[2.5rem] border-2 border-[#2a1b12] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* 줄거리 직접 편집 영역 */}
      <div className="p-6 md:p-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl text-[#2d5a27] flex items-center gap-2 font-bold">
            <BookOpenCheck className="w-7 h-7" />
            동화책 줄거리
          </h2>
          <span className="text-[#8b7a52] font-sans text-sm inline-flex items-center gap-2">
            {editPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {editPending ? '저장 중' : `약 ${draft.length}자`}
          </span>
        </div>

        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => onSummaryEdit(draft)}
          disabled={locked}
          maxLength={4000}
          className="w-full min-h-[16rem] p-6 rounded-2xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] text-lg leading-relaxed font-sans whitespace-pre-wrap focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 focus:outline-none resize-none disabled:opacity-90 disabled:cursor-not-allowed"
        />
        <p className="mt-3 text-[#8b7a52] text-sm">
          {locked
            ? '확정된 줄거리예요. 본문 작업이 시작되어 줄거리는 더 이상 변경할 수 없어요.'
            : '표현이나 단어를 직접 다듬을 수 있어요. 큰 의미 변경(여행지/등장인물 등)은 아래 "AI 에게 다시 요청하기" 가 더 정확해요.'}
        </p>
      </div>

      {locked ? (
        /* 잠금 상태 — 재요청 영역 대신 안내 배너 */
        <div className="bg-[#e8ddb4] px-6 md:px-8 py-5 border-t-2 border-[#8b7a52]/40">
          <p className="text-[#2d5a27] text-sm flex items-center justify-center gap-2 font-bold">
            <BookOpenCheck className="w-5 h-5" />
            본문 편집은 다음 단계에서 이어서 할 수 있어요.
          </p>
        </div>
      ) : (
        /* 미잠금 — AI 재요청 영역 */
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
              disabled={regenerating}
            />
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating || refinePrompt.trim().length === 0}
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
            재요청 시 기존 줄거리는 새 결과로 교체됩니다.
          </p>
        </div>
      )}
    </div>
  )
}
