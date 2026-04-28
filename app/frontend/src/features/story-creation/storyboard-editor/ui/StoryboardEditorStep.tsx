import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react'
import {
  useGenerateStoryboardImagesPost,
  useRegenerateStoryboardImagePost,
  useStoryboardPagePatch,
  useStoryboardPagesQuery,
  type StoryboardPageItem,
} from '../../storyboard-pages'
import {
  useGenerationJobQuery,
  useStoryboardStateQuery,
} from '../../storyboard-prompt'
import { useGenerateStoryboardStoryPost } from '../../storyboard-prompt/model/useGenerateStoryboardStoryPost'
import { deleteStory } from '../../basic-info'
import { ROUTES } from '../../../../shared/constants'

/** "마지막 SUCCESS 이후 FAILED" 한도. 이 값 이상이면 사용자에게 사과 + 메인 페이지 이동. */
const FAILED_LIMIT = 3
/** 한도 초과 시 자동 메인 이동까지의 카운트다운(ms). 사용자가 메시지를 읽을 시간 + "지금 이동" 으로 단축 가능. */
const LIMIT_EXCEEDED_REDIRECT_MS = 5_000

interface StoryboardEditorStepProps {
  storyId: number | null
  /**
   * Step 3 의 "스토리 확정하고 다음" 클릭으로 막 발행된 본문(STORY) 잡 id.
   * null 이면 storyboard-pages 캐시 기반 fallback 동작 (새로고침 후 재진입 등).
   */
  storyGenerationJobId: number | null
  /** STORY 잡이 종결(SUCCESS/FAILED/CANCELLED/타임아웃) 시 호출 — 부모 flow 의 jobId 를 null 로. */
  onStoryJobFinished: () => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 04 — "스토리보드 다듬기 + 이미지 생성"
 *
 * 옵션 D 적용 후 책임:
 *  - 페이지별 한글 본문 편집 (textarea onBlur → PATCH /storyboard/pages/{n})
 *  - 페이지별 이미지 표시 (image_url) / 없으면 "이미지 생성" 버튼
 *  - 페이지별 이미지 재생성 (userPrompt + POST /storyboard/pages/{n}/image/regenerate)
 *  - 전체 이미지 배치 생성 (POST /storyboard/images)
 *  - 진행 중인 이미지 잡(jobId)을 polling 해 페이지 image_url 자동 갱신
 *
 * UI 정책:
 *  - 모든 페이지에 image_url 이 있으면 "다음" 버튼 활성. (없어도 다음 가능 — 단순화)
 *  - 진행 중에는 전체 생성 버튼 disabled, 페이지별 재생성 버튼도 disabled (동시 폭주 방지).
 */
export function StoryboardEditorStep({
  storyId,
  storyGenerationJobId,
  onStoryJobFinished,
  onBack,
  onNext,
}: StoryboardEditorStepProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const pagesQuery = useStoryboardPagesQuery(storyId)
  const patchMut = useStoryboardPagePatch(storyId)
  const generateImagesMut = useGenerateStoryboardImagesPost(storyId)
  const regenerateImageMut = useRegenerateStoryboardImagePost(storyId)
  // "다시 시도" 버튼 클릭 시 본문 발행 재시도 — Step 3 의 publish 흐름과 동일.
  const publishStoryMut = useGenerateStoryboardStoryPost(storyId)

  // ────────────────────────────────────────────────────────────
  // BE 진실 기반 잡 상태 조회 — sessionStorage 가 비어 있는 엣지케이스 (탭 닫고 재진입) 에서도
  // 활성 잡 / 직전 terminal status / "마지막 SUCCESS 이후 FAILED 카운트" 를 한 번에 받아온다.
  // ────────────────────────────────────────────────────────────
  const stateQuery = useStoryboardStateQuery(storyId)
  const stateData = stateQuery.data

  // sessionStorage 의 jobId 가 우선 — 없으면 BE state 의 active job id 로 회복.
  const recoveredJobId = stateData?.activeJob?.jobId ?? null
  const effectiveStoryJobId = storyGenerationJobId ?? recoveredJobId

  // ────────────────────────────────────────────────────────────
  // 본문(STORY) 잡 폴링 — effectiveStoryJobId (props 또는 recovery) 기반.
  // PENDING/RUNNING 동안 "본문 생성 중" 화면을 띄우고, SUCCESS 시 페이지 캐시 invalidate.
  // ────────────────────────────────────────────────────────────
  const storyJobQuery = useGenerationJobQuery(effectiveStoryJobId)
  const storyJobStatus = storyJobQuery.data?.status
  const isStoryJobInProgress =
    effectiveStoryJobId !== null &&
    !storyJobQuery.isTimedOut &&
    storyJobStatus !== 'SUCCESS' &&
    storyJobStatus !== 'FAILED' &&
    storyJobStatus !== 'CANCELLED'

  // FAILED 분기:
  //  (a) 같은 세션에서 polling 도중 FAILED — storyJobStatus / timeout 으로 감지
  //  (b) recovery 케이스 — BE state.latestFinalStatus === 'FAILED' (탭 닫고 재진입 후 활성 잡 없음)
  const pollingFailed =
    effectiveStoryJobId !== null &&
    (storyJobStatus === 'FAILED' || storyJobStatus === 'CANCELLED' || storyJobQuery.isTimedOut)
  const recoveredFailed =
    !isStoryJobInProgress &&
    stateData != null &&
    stateData.activeJob === null &&
    stateData.latestFinalStatus === 'FAILED'

  // 한도 초과 — 마지막 SUCCESS 이후 FAILED 가 FAILED_LIMIT 이상.
  // BE 가 카운트한 진실값을 그대로 사용 (FE sessionStorage 우회 불가).
  const isLimitExceeded = (stateData?.failedCountSinceLastSuccess ?? 0) >= FAILED_LIMIT

  // 한도 미달 + FAILED → "다시 시도" 카드 노출.
  const isStoryJobFailed = !isLimitExceeded && (pollingFailed || recoveredFailed)

  // Step 4 진입 시점에 한 번은 강제 refetch — PromptStep 이 staleTime: 30s 로 들고 있던
  // "0 pages" 캐시가 박제되는 걸 방어. STORY 잡이 직전에 SUCCESS 해 페이지가 BE 에 이미 있어도
  // FE 는 stale 캐시 때문에 "본문 없음" 화면을 띄우고 새로고침 전엔 못 빠져나오는 사고가 있었음.
  useEffect(() => {
    if (storyId !== null) {
      void queryClient.refetchQueries({ queryKey: ['storyboard-pages', storyId] })
    }
    // storyId 변경 / 컴포넌트 mount 단위로만 동작 — polling 갱신 noise 와 분리.
  }, [storyId, queryClient])

  // STORY 잡 폴링 중 매 갱신마다 storyboard-pages 캐시 invalidate
  // (listener 가 SUCCESS 직후 페이지 row INSERT 하므로, 다음 polling tick 의 invalidate 가
  //  pagesQuery refetch 를 트리거 → 페이지 즉시 렌더).
  useEffect(() => {
    if (effectiveStoryJobId !== null && storyId !== null) {
      void queryClient.invalidateQueries({ queryKey: ['storyboard-pages', storyId] })
    }
  }, [storyJobQuery.dataUpdatedAt, effectiveStoryJobId, queryClient, storyId])

  // STORY 잡 종결 시 부모 flow 의 jobId 를 null 로 → UI 가 정상 모드로 전환.
  // SUCCESS 케이스는 폴링이 더 이상 필요 없지만 그 직후 페이지가 화면에 보장되어야 한다.
  // invalidate(fire-and-forget) 만 하면 onStoryJobFinished 가 storyGenerationJobId 를 null 로
  // 떨어뜨리는 동기 step 이 refetch 보다 먼저 commit 되어 잠깐 "아직 본문이 만들어지지 않았어요"
  // empty state 가 노출된 뒤 refetch 결과가 도착하면서 점프하는 어색한 UX 가 생긴다.
  // 더 나쁜 경우엔 PromptStep 이 미리 캐싱해 둔 0-pages stale 데이터가 30s staleTime 동안
  // 박제되어 새로고침 전엔 영영 페이지가 안 보이는 사고로 이어진다.
  // → refetchQueries 로 명시적으로 await 한 다음 onStoryJobFinished 를 호출.
  //
  // FAILED/CANCELLED/timeout 케이스에선 storyboard-state 도 같이 refetch — failedCount 를 갱신해
  // "다시 시도" 카드의 횟수 표시 / 한도 초과 분기가 즉시 반영되도록.
  useEffect(() => {
    if (
      effectiveStoryJobId !== null &&
      (storyJobStatus === 'SUCCESS' ||
        storyJobStatus === 'FAILED' ||
        storyJobStatus === 'CANCELLED' ||
        storyJobQuery.isTimedOut)
    ) {
      if (storyJobStatus === 'SUCCESS' && storyId !== null) {
        // refetch 를 await — 페이지 데이터가 캐시에 도착한 다음에야 jobId 를 null 로 떨어뜨려
        // empty-state flicker / 새로고침 의존 사고를 동시에 봉인.
        queryClient
          .refetchQueries({ queryKey: ['storyboard-pages', storyId] })
          .finally(() => {
            // SUCCESS 후 상태 카운터도 갱신 (failedCount 가 reset 효과를 갖도록)
            void queryClient.refetchQueries({ queryKey: ['storyboard-state', storyId] })
            onStoryJobFinished()
          })
        return
      }
      // 실패/취소/타임아웃 — failedCount 갱신 후 jobId 정리.
      if (storyId !== null) {
        void queryClient.refetchQueries({ queryKey: ['storyboard-state', storyId] })
      }
      onStoryJobFinished()
    }
  }, [
    storyJobStatus,
    storyJobQuery.isTimedOut,
    effectiveStoryJobId,
    onStoryJobFinished,
    queryClient,
    storyId,
  ])

  // ────────────────────────────────────────────────────────────
  // 한도 초과 (failedCount >= 3) — soft-delete + 카운트다운 후 메인 페이지 이동.
  // 사용자가 메시지를 읽을 시간을 주되 "지금 이동" 버튼으로 즉시 이동 가능.
  // ────────────────────────────────────────────────────────────
  const limitDeleteMut = useMutation({
    mutationFn: async (id: number) => deleteStory(id),
  })

  const goHomeAfterLimit = useCallback(() => {
    if (storyId === null) {
      navigate(ROUTES.home, { replace: true })
      return
    }
    // story soft-delete 후 메인 이동 — 다음 진입 시 깨진 story 가 안 보이도록.
    // delete 실패해도 사용자 경험을 막지 않도록 catch 후 강제 navigate.
    limitDeleteMut.mutate(storyId, {
      onSettled: () => {
        navigate(ROUTES.home, { replace: true })
      },
    })
  }, [storyId, navigate, limitDeleteMut])

  // 한도 초과 진입 시 N초 카운트다운 후 자동 redirect.
  useEffect(() => {
    if (!isLimitExceeded) return
    const timer = window.setTimeout(() => {
      goHomeAfterLimit()
    }, LIMIT_EXCEEDED_REDIRECT_MS)
    return () => window.clearTimeout(timer)
  }, [isLimitExceeded, goHomeAfterLimit])

  // 다시 시도 — 본문(STORY) 잡 재발행 → polling 다시 시작.
  // 성공 시 부모 flow 의 storyGenerationJobId 를 새 jobId 로 세팅하면 좋지만, 현재 부모는
  // setter 를 prop 으로 노출하지 않아서 storyboard-state refetch 로 새 active job 을 잡아온다
  // (recovery 경로 재활용). 한 번에 추가 props 변경 없이 동작.
  const handleRetryStory = useCallback(() => {
    publishStoryMut.mutate(
      { prompt: null },
      {
        onSettled: () => {
          // 잡이 새로 발행됐을 거라 state 재조회 → activeJob 채워지고 polling 재시작.
          if (storyId !== null) {
            void queryClient.refetchQueries({ queryKey: ['storyboard-state', storyId] })
          }
        },
      },
    )
  }, [publishStoryMut, queryClient, storyId])

  // 진행 중인 이미지 잡 (배치 생성 / 재생성 중 하나).
  // 잡이 SUCCESS/FAILED/타임아웃 도달하면 null 로 되돌려 UI 풀림.
  const [currentImageJobId, setCurrentImageJobId] = useState<number | null>(null)
  const imageJobQuery = useGenerationJobQuery(currentImageJobId)

  // 진행 중 폴링이 갱신될 때마다 페이지 캐시도 invalidate → 페이지마다 image_url 즉시 표시.
  useEffect(() => {
    if (currentImageJobId !== null && storyId !== null) {
      void queryClient.invalidateQueries({ queryKey: ['storyboard-pages', storyId] })
    }
  }, [imageJobQuery.dataUpdatedAt, currentImageJobId, queryClient, storyId])

  // 잡 마무리(SUCCESS/FAILED/CANCELLED/타임아웃) 처리.
  useEffect(() => {
    const status = imageJobQuery.data?.status
    if (
      currentImageJobId !== null &&
      (status === 'SUCCESS' || status === 'FAILED' || status === 'CANCELLED' || imageJobQuery.isTimedOut)
    ) {
      setCurrentImageJobId(null)
      if (storyId !== null) {
        void queryClient.invalidateQueries({ queryKey: ['storyboard-pages', storyId] })
      }
    }
  }, [imageJobQuery.data?.status, imageJobQuery.isTimedOut, currentImageJobId, queryClient, storyId])

  const pages: StoryboardPageItem[] = useMemo(
    () =>
      (pagesQuery.data?.pages ?? []).slice().sort((a, b) => a.pageNumber - b.pageNumber),
    [pagesQuery.data],
  )

  // 페이지별 textarea local draft. BE 데이터가 새로 도착할 때 초기값만 채우고,
  // 이미 유저가 편집 중이면 덮어쓰지 않는다.
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  useEffect(() => {
    setDrafts(prev => {
      const next = { ...prev }
      for (const p of pages) {
        if (next[p.pageNumber] === undefined) {
          next[p.pageNumber] = p.koreanText ?? ''
        }
      }
      return next
    })
  }, [pages])

  // 페이지별 재생성 input 값.
  const [regeneratePrompts, setRegeneratePrompts] = useState<Record<number, string>>({})

  const handleDraftChange = useCallback((pageNumber: number, value: string) => {
    setDrafts(prev => ({ ...prev, [pageNumber]: value }))
  }, [])

  const handleDraftBlur = useCallback(
    (pageNumber: number, original: string | null) => {
      const value = drafts[pageNumber] ?? ''
      const trimmed = value.trim()
      if (trimmed.length === 0) return
      if (trimmed === (original ?? '').trim()) return // 변화 없으면 PATCH 안 보냄
      patchMut.mutate({ pageNumber, koreanText: trimmed })
    },
    [drafts, patchMut],
  )

  const handleGenerateAllImages = useCallback(() => {
    generateImagesMut.mutate(undefined, {
      onSuccess: res => setCurrentImageJobId(res.jobId),
    })
  }, [generateImagesMut])

  const handleRegenerateImage = useCallback(
    (pageNumber: number) => {
      const userPrompt = (regeneratePrompts[pageNumber] ?? '').trim()
      if (userPrompt.length === 0) return
      regenerateImageMut.mutate(
        { pageNumber, userPrompt },
        {
          onSuccess: res => {
            setCurrentImageJobId(res.jobId)
            setRegeneratePrompts(prev => ({ ...prev, [pageNumber]: '' }))
          },
        },
      )
    },
    [regenerateImageMut, regeneratePrompts],
  )

  // 진행 중 여부 — 어떤 이미지 잡이든 PENDING/RUNNING 이면 모든 image 액션 disable.
  const isImageJobInProgress =
    currentImageJobId !== null &&
    !imageJobQuery.isTimedOut &&
    imageJobQuery.data?.status !== 'SUCCESS' &&
    imageJobQuery.data?.status !== 'FAILED' &&
    imageJobQuery.data?.status !== 'CANCELLED'

  const allImagesReady = pages.length > 0 && pages.every(p => !!p.imageUrl)
  const someImagesReady = pages.some(p => !!p.imageUrl)

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
          <span className="text-[#b4c4a4] text-sm font-bold tracking-wider">STEP 04 / 08</span>
          <span className="bookshelf-title-display text-2xl text-[#f0e6c0] font-bold">
            스토리보드 다듬기
          </span>
        </div>
      </div>

      <div className="bookshelf-scroll">
        <main className="py-10 px-6 bookshelf-fade-in">
          <div className="max-w-7xl mx-auto pb-12">
            {/* 타이틀 */}
            <div className="mb-8 text-center">
              <div className="inline-flex items-center gap-2 bg-[#2d5a27]/60 px-5 py-2 rounded-full border border-[#b4dc8c]/50 shadow-sm mb-4">
                <Sparkles className="w-5 h-5 text-[#b4dc8c]" />
                <span className="text-[#b4dc8c] font-bold">페이지별로 글과 그림을 다듬어보세요</span>
              </div>
              <h1 className="text-3xl md:text-4xl text-[#f0e6c0] mb-3 font-bold">
                우리 가족의 이야기 페이지
              </h1>
              <p className="text-[#b4c4a4] text-lg">
                페이지마다 글을 직접 다듬고, 마음에 드는 그림이 나올 때까지 다시 그릴 수 있어요.
              </p>
            </div>

            {/* 전체 이미지 생성 버튼 */}
            {pages.length > 0 && !someImagesReady && (
              <div className="bg-[#f0e6c0] rounded-2xl border-2 border-[#2a1b12] shadow-md p-6 md:p-8 mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-xl text-[#2d5a27] font-bold mb-1 flex items-center gap-2">
                      <ImageIcon className="w-6 h-6" />
                      모든 페이지 그림 만들기
                    </h3>
                    <p className="text-[#8b7a52]">
                      AI 가 페이지마다 한 장씩 그림을 그려요. 보통 페이지당 10~30초.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAllImages}
                    disabled={
                      storyId === null ||
                      generateImagesMut.isPending ||
                      isImageJobInProgress
                    }
                    className="bg-[#2d5a27] text-[#f0e6c0] px-6 py-4 rounded-xl font-bold hover:bg-[#3d6f34] border border-[#b4dc8c]/40 transition-colors flex items-center gap-2 shadow-[0_4px_0_#1a3a14] disabled:opacity-40 disabled:cursor-not-allowed text-lg"
                  >
                    {isImageJobInProgress ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> 그리는 중
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" /> 그림 만들기 시작
                      </>
                    )}
                  </button>
                </div>
                {generateImagesMut.error && (
                  <p className="mt-3 text-[#a3413f] text-sm">
                    그림 생성 시작에 실패했어요: {generateImagesMut.error.message}
                  </p>
                )}
              </div>
            )}

            {/* 진행 중 안내 (이미 일부 페이지가 생성됐어도 동일한 표시) */}
            {isImageJobInProgress && (
              <div className="bg-[#2a1b12]/60 border-2 border-[#b4dc8c]/40 rounded-2xl p-4 mb-8 text-center">
                <p className="text-[#b4dc8c] font-bold inline-flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AI 가 페이지를 그리는 중이에요. 완성된 페이지부터 자동으로 표시됩니다.
                </p>
              </div>
            )}

            {/* 한도 초과 — 마지막 SUCCESS 이후 FAILED 횟수가 3회 이상.
                story soft-delete + N초 카운트다운 후 자동 메인 이동, "지금 이동" 버튼으로 즉시 이동도 가능. */}
            {isLimitExceeded && (
              <LimitExceededCard
                failedCount={stateData?.failedCountSinceLastSuccess ?? 0}
                limit={FAILED_LIMIT}
                redirectMs={LIMIT_EXCEEDED_REDIRECT_MS}
                onGoNow={goHomeAfterLimit}
                isDeleting={limitDeleteMut.isPending}
              />
            )}

            {/* STORY 잡 진행 중 — 페이지 카드 대신 큰 로딩 카드를 표시.
                Step 3 에서 "스토리 확정하고 다음" 직후 도달하는 정상 케이스 + recovery (탭 닫고 재진입) 모두 동일 화면. */}
            {!isLimitExceeded && isStoryJobInProgress && pages.length === 0 && (
              <div className="bg-[#f0e6c0] rounded-2xl border-2 border-[#2a1b12] p-10 text-center">
                <Loader2 className="w-10 h-10 text-[#2d5a27] animate-spin mx-auto mb-4" />
                <p className="text-[#2d5a27] font-bold mb-2">동화 본문을 만들고 있어요</p>
                <p className="text-[#8b7a52]">
                  AI 가 페이지별 글을 쓰고 있어요. 보통 30초 ~ 1분 정도 걸려요.
                </p>
              </div>
            )}

            {/* STORY 잡 실패 (한도 미달) — "다시 시도하기" 버튼.
                한도(FAILED_LIMIT) 까지 재시도 후 자동 사과 흐름으로 전환. */}
            {!isLimitExceeded && isStoryJobFailed && pages.length === 0 && (
              <FailedRetryCard
                failedCount={stateData?.failedCountSinceLastSuccess ?? 0}
                limit={FAILED_LIMIT}
                onRetry={handleRetryStory}
                onBack={onBack}
                retrying={publishStoryMut.isPending}
              />
            )}

            {/* state 1차 fetch 진행 중 (recovery 케이스에서 BE 응답 오기 전 빈 화면 깜빡임 방어).
                storyGenerationJobId 가 prop 으로 들어와 있으면 굳이 기다릴 필요 없음 — pages 로 바로 분기. */}
            {!isLimitExceeded &&
              !isStoryJobInProgress &&
              !isStoryJobFailed &&
              storyGenerationJobId === null &&
              stateQuery.isLoading && (
                <div className="bg-[#f0e6c0] rounded-2xl border-2 border-[#2a1b12] p-10 text-center">
                  <Loader2 className="w-10 h-10 text-[#2d5a27] animate-spin mx-auto mb-4" />
                  <p className="text-[#2d5a27] font-bold">상태 확인 중...</p>
                </div>
            )}

            {/* 페이지 캐시 자체 로딩 — 위 케이스들이 모두 false 일 때만. */}
            {!isLimitExceeded &&
              !isStoryJobInProgress &&
              !isStoryJobFailed &&
              !stateQuery.isLoading &&
              pagesQuery.isLoading && (
                <div className="bg-[#f0e6c0] rounded-2xl border-2 border-[#2a1b12] p-10 text-center">
                  <Loader2 className="w-10 h-10 text-[#2d5a27] animate-spin mx-auto mb-4" />
                  <p className="text-[#2d5a27] font-bold">페이지를 불러오는 중...</p>
                </div>
              )}

            {/* 잡도 없고 페이지도 없는 진짜 "Step 3 이전" 상태 (직접 진입 또는 stale URL). */}
            {!isLimitExceeded &&
              !isStoryJobInProgress &&
              !isStoryJobFailed &&
              !stateQuery.isLoading &&
              !pagesQuery.isLoading &&
              pages.length === 0 && (
                <div className="bg-[#f0e6c0] rounded-2xl border-2 border-[#2a1b12] p-10 text-center">
                  <p className="text-[#2d5a27] font-bold mb-2">아직 동화 본문이 만들어지지 않았어요</p>
                  <p className="text-[#8b7a52]">이전 단계에서 줄거리를 만들고 본문을 확정해주세요.</p>
                </div>
              )}

            {/* 페이지 카드 — 한 줄에 1 개씩. 양옆을 max-w-7xl 로 넓혀 이미지가 충분히 크게. */}
            <div className="space-y-6">
              {pages.map(page => (
                <PageCard
                  key={page.pageNumber}
                  page={page}
                  draft={drafts[page.pageNumber] ?? ''}
                  onDraftChange={value => handleDraftChange(page.pageNumber, value)}
                  onDraftBlur={() => handleDraftBlur(page.pageNumber, page.koreanText)}
                  regeneratePrompt={regeneratePrompts[page.pageNumber] ?? ''}
                  onRegeneratePromptChange={value =>
                    setRegeneratePrompts(prev => ({ ...prev, [page.pageNumber]: value }))
                  }
                  onRegenerateImage={() => handleRegenerateImage(page.pageNumber)}
                  regenerateDisabled={isImageJobInProgress || regenerateImageMut.isPending}
                  patchPending={patchMut.isPending}
                />
              ))}
            </div>

            {/* 하단 액션 */}
            <div className="flex justify-between items-center pt-8 mt-8 border-t border-[#4a3a24]">
              <button
                type="button"
                onClick={onBack}
                className="text-[#b4c4a4] hover:text-[#f0e6c0] px-4 py-2 text-xl font-bold transition-colors"
              >
                이전
              </button>
              <div className="text-[#b4dc8c] font-bold hidden sm:flex items-center gap-2 bg-[#2d5a27]/60 px-6 py-2.5 rounded-full border border-[#b4dc8c]/40 text-lg shadow-sm">
                <CheckCircle className="w-6 h-6" />
                <span>{allImagesReady ? '모든 그림이 준비됐어요' : '편집 진행 중'}</span>
              </div>
              <button
                type="button"
                onClick={onNext}
                className="bg-[#2d5a27] text-[#f0e6c0] px-10 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.5)] hover:bg-[#3d6f34] transition-all font-bold flex items-center gap-3 text-xl whitespace-nowrap"
              >
                다음: 그림 스타일 선택 <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/**
 * 페이지 1장 카드 — 글 textarea + 이미지(또는 placeholder) + 재생성 input.
 */
function PageCard(props: {
  page: StoryboardPageItem
  draft: string
  onDraftChange: (value: string) => void
  onDraftBlur: () => void
  regeneratePrompt: string
  onRegeneratePromptChange: (value: string) => void
  onRegenerateImage: () => void
  regenerateDisabled: boolean
  patchPending: boolean
}) {
  const {
    page,
    draft,
    onDraftChange,
    onDraftBlur,
    regeneratePrompt,
    onRegeneratePromptChange,
    onRegenerateImage,
    regenerateDisabled,
    patchPending,
  } = props

  return (
    <div className="bg-[#f0e6c0] rounded-2xl border-2 border-[#2a1b12] shadow-md overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-[#e8ddb4] border-b-2 border-[#8b7a52]/40">
        <span className="text-[#2d5a27] font-bold">페이지 {page.pageNumber}</span>
        {patchPending && (
          <span className="text-[#8b7a52] text-sm inline-flex items-center gap-1">
            <Loader2 className="w-4 h-4 animate-spin" /> 저장 중
          </span>
        )}
      </div>

      {/* 이미지(왼쪽) + 텍스트(오른쪽) — 카드 내부 좌우 2분할.
          items-start: 이미지 column 이 자체 aspect-square 높이만 유지하고
          텍스트가 길어도 옆에 빈 공간을 만들지 않게 한다. */}
      <div className="grid grid-cols-2 gap-0 items-start">
        {/* 이미지 영역 — 카드 폭의 절반 = aspect-square */}
        <div className="bg-[#e8ddb4] aspect-square flex items-center justify-center border-r-2 border-[#8b7a52]/40 overflow-hidden self-start">
          {page.imageUrl ? (
            <img
              src={page.imageUrl}
              alt={`페이지 ${page.pageNumber} 그림`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center text-[#8b7a52] p-6">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-60" />
              <p>아직 그림이 없어요.</p>
              <p className="text-sm">상단 "그림 만들기 시작" 을 눌러주세요.</p>
            </div>
          )}
        </div>

        {/* 텍스트 영역 — 영어 메인 + 한글 보조 + 재생성 */}
        <div className="p-5 flex flex-col">
          {/* 영어 본문 — 메인 */}
          <div className="mb-4">
            <label className="text-[#2d5a27] font-bold mb-2 block text-sm uppercase tracking-wide">
              English
            </label>
            <div className="p-4 rounded-lg bg-[#fbf3d4] border-2 border-[#8b7a52]/60 text-[#2d5a27] text-base leading-relaxed font-sans whitespace-pre-wrap min-h-[6rem]">
              {page.englishText?.trim() || '(영어 본문이 아직 없어요)'}
            </div>
          </div>

          {/* 한글 해석 — 보조 */}
          <div>
            <label className="text-[#8b7a52] font-bold mb-2 flex items-center justify-between text-sm uppercase tracking-wide">
              <span>한글 해석</span>
              <span className="text-[#8b7a52]/70 normal-case tracking-normal text-xs">
                포커스 빼면 자동 저장
              </span>
            </label>
            <textarea
              value={draft}
              onChange={e => onDraftChange(e.target.value)}
              onBlur={onDraftBlur}
              className="w-full h-24 p-3 rounded-lg bg-[#f5ebc0] border border-[#8b7a52]/40 text-[#5a4a27] text-sm leading-relaxed focus:border-[#2d5a27] focus:ring-2 focus:ring-[#b4dc8c]/30 focus:outline-none resize-none font-sans"
              maxLength={4000}
              placeholder="한글 해석을 다듬어 주세요"
            />
          </div>

          {/* 이미지 재생성 */}
          <div className="mt-4 pt-4 border-t-2 border-[#8b7a52]/30">
            <label className="text-[#2d5a27] font-bold mb-2 flex items-center gap-2 text-sm">
              <Wand2 className="w-4 h-4" /> 그림 다시 그리기
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={regeneratePrompt}
                onChange={e => onRegeneratePromptChange(e.target.value)}
                placeholder="예: '따뜻한 색감으로'"
                className="flex-1 p-2.5 rounded-md border-2 border-[#b4dc8c] bg-[#fbf3d4] focus:border-[#2d5a27] focus:outline-none text-sm font-sans text-[#2d5a27] placeholder-[#8b7a52]/60"
              />
              <button
                type="button"
                onClick={onRegenerateImage}
                disabled={regenerateDisabled || regeneratePrompt.trim().length === 0}
                className="bg-[#2d5a27] text-[#f0e6c0] px-4 py-2 rounded-md font-bold hover:bg-[#3d6f34] border border-[#b4dc8c]/40 transition-colors flex items-center gap-1 text-sm shadow-[0_2px_0_#1a3a14] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * STORY 잡 FAILED — 한도(FAILED_LIMIT) 미달 시 노출.
 * "다시 시도" 버튼 + 이전 단계 복귀 버튼. 시도 횟수도 같이 안내해 사용자가 한도 도달 임박을 인지.
 */
function FailedRetryCard(props: {
  failedCount: number
  limit: number
  onRetry: () => void
  onBack: () => void
  retrying: boolean
}) {
  const { failedCount, limit, onRetry, onBack, retrying } = props
  const remaining = Math.max(0, limit - failedCount)

  return (
    <div className="bg-[#f0e6c0] rounded-2xl border-2 border-[#2a1b12] p-10 text-center">
      <AlertTriangle className="w-10 h-10 text-[#a3413f] mx-auto mb-3" />
      <p className="text-[#a3413f] font-bold text-lg mb-2">본문 생성에 실패했어요</p>
      <p className="text-[#8b7a52] mb-1">잠시 후 다시 시도해 주세요.</p>
      <p className="text-[#8b7a52] text-sm mb-6">
        남은 시도 횟수: <span className="font-bold text-[#2d5a27]">{remaining}</span>회
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={retrying}
          className="px-5 py-2.5 rounded-full font-bold text-[#2d5a27] bg-transparent border-2 border-[#2d5a27]/40 hover:bg-[#2d5a27]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          이전 단계로
        </button>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="bg-[#2d5a27] text-[#f0e6c0] px-6 py-2.5 rounded-full font-bold hover:bg-[#3d6f34] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {retrying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> 다시 시도 중
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4" /> 다시 시도하기
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/**
 * 한도 초과 — 마지막 SUCCESS 이후 FAILED 가 limit 이상.
 * "죄송합니다" 안내 + 카운트다운(redirectMs) + "지금 이동" 버튼.
 *
 * 부모가 N초 후 자동 redirect 를 처리하므로 이 컴포넌트는 시각/안내만 담당.
 * "지금 이동" 클릭 → 부모 onGoNow → soft-delete + navigate(home).
 */
function LimitExceededCard(props: {
  failedCount: number
  limit: number
  redirectMs: number
  onGoNow: () => void
  isDeleting: boolean
}) {
  const { failedCount, limit, redirectMs, onGoNow, isDeleting } = props

  // 카운트다운 표시 — 1초 단위로 갱신.
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(redirectMs / 1000))
  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="bg-[#f0e6c0] rounded-2xl border-2 border-[#a3413f] p-10 text-center">
      <AlertTriangle className="w-12 h-12 text-[#a3413f] mx-auto mb-4" />
      <p className="text-[#a3413f] font-bold text-xl mb-3">죄송합니다</p>
      <p className="text-[#2d5a27] font-bold mb-2">
        본문 생성이 {failedCount}회 연속 실패했어요 (한도 {limit}회).
      </p>
      <p className="text-[#8b7a52] mb-6">
        이번 동화 만들기는 잠시 멈추고 메인 페이지로 돌아갈게요.
        <br />
        잠시 후 다시 시도해 주시면 감사하겠습니다.
      </p>
      <div className="flex flex-col items-center gap-3">
        <p className="text-[#8b7a52] text-sm">
          {secondsLeft > 0 ? (
            <>
              <span className="font-bold text-[#2d5a27]">{secondsLeft}</span>초 후 자동으로 이동돼요
            </>
          ) : (
            '곧 이동돼요...'
          )}
        </p>
        <button
          type="button"
          onClick={onGoNow}
          disabled={isDeleting}
          className="bg-[#2d5a27] text-[#f0e6c0] px-8 py-3 rounded-full font-bold hover:bg-[#3d6f34] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isDeleting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> 정리 중
            </>
          ) : (
            <>지금 이동</>
          )}
        </button>
      </div>
    </div>
  )
}
