import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle,
  History,
  ImageIcon,
  Loader2,
  Pencil,
  Quote,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react'
import {
  useGenerateStoryboardImagesPost,
  useRegenerateStoryboardImagePost,
  useSelectStoryboardPageImageVersionPost,
  useStoryboardPageImageVersionsQuery,
  useStoryboardPagePatch,
  useStoryboardPagesQuery,
  useStoryboardRegenStatusQuery,
  type StoryboardImageVersionEntry,
  type StoryboardPageItem,
} from '../../storyboard-pages'
import {
  useGenerationJobQuery,
  useStoryboardStateQuery,
} from '../../storyboard-prompt'
import { useGenerateStoryboardStoryPost } from '../../storyboard-prompt/model/useGenerateStoryboardStoryPost'
import { deleteStory } from '../../basic-info'
import { ROUTES } from '../../../../shared/constants'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { StepTitleBlock } from '../../ui/StepTitleBlock'

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
  const selectVersionMut = useSelectStoryboardPageImageVersionPost(storyId)
  // 동화(스토리) 단위 재생성 카운터 — 헤더 우측 카운터 + 한도 검사용. BE 가 SoT.
  const regenStatusQuery = useStoryboardRegenStatusQuery(storyId)
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

  // 어떤 페이지가 현재 재생성 요청 중인지 추적 — 페이지별 spinner / 에러 표시에 사용.
  // (regenerateImageMut 자체는 페이지 무관 단일 instance 라 별도 ref 필요.)
  // 폴링이 끝날 때까지 유지되어 mutate inflight 뿐 아니라 server 폴링 동안에도 스피너 노출.
  const [regeneratingPageNumber, setRegeneratingPageNumber] = useState<number | null>(null)
  const [regenerateErrors, setRegenerateErrors] = useState<Record<number, string>>({})

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
      // 단일 페이지 재생성 폴링 종료 — 페이지별 스피너 해제 + 실패 시 메시지 / 성공 시 캐시버스터.
      if (regeneratingPageNumber !== null) {
        if (status === 'FAILED' || status === 'CANCELLED' || imageJobQuery.isTimedOut) {
          const failedPage = regeneratingPageNumber
          setRegenerateErrors(prev => ({
            ...prev,
            [failedPage]:
              status === 'FAILED'
                ? '그림 재생성에 실패했어요. 잠시 후 다시 시도해 주세요.'
                : status === 'CANCELLED'
                  ? '그림 재생성이 취소됐어요.'
                  : '그림 재생성이 너무 오래 걸려 중단됐어요.',
          }))
        }
      }
      if (storyId !== null) {
        // 단순 invalidate 가 아닌 refetch — staleTime/observer 상태와 무관하게 반드시 새로 받도록.
        void queryClient.refetchQueries({ queryKey: ['storyboard-pages', storyId] })
        // 카운터 / picker 도 갱신 — SUCCESS/FAILED 모두 status 카운트가 +1 되고,
        // SUCCESS 시 versions 리스트에 새 버전 entry 가 추가됨.
        void queryClient.refetchQueries({ queryKey: ['storyboard-regen-status', storyId] })
        if (regeneratingPageNumber !== null) {
          void queryClient.refetchQueries({
            queryKey: ['storyboard-image-versions', storyId, regeneratingPageNumber],
          })
        }
      }
      if (regeneratingPageNumber !== null) {
        setRegeneratingPageNumber(null)
      }
    }
  }, [
    imageJobQuery.data?.status,
    imageJobQuery.isTimedOut,
    currentImageJobId,
    regeneratingPageNumber,
    queryClient,
    storyId,
  ])

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

  // 동화 단위 재생성 한도/사용량 — BE 가 SoT. 한도 도달이면 모든 페이지의 재생성 버튼 disabled.
  const regenStatus = regenStatusQuery.data
  const regenLimit = regenStatus?.limit ?? FAILED_LIMIT // 데이터 도착 전 임시 fallback (UI 만)
  const regenUsed = regenStatus?.used ?? 0
  const regenRemaining = regenStatus?.remaining ?? Math.max(0, regenLimit - regenUsed)

  // 보기 모드 — 'grid' (한 줄 3장 갤러리) / 'individual' (페이지마다 글+이미지+재생성).
  // 그리드에서 사진 클릭 시 individual 모드로 전환 + 해당 페이지로 스크롤.
  const [viewMode, setViewMode] = useState<'grid' | 'individual'>('individual')
  const [pendingScrollPage, setPendingScrollPage] = useState<number | null>(null)

  const handleSelectPageFromGrid = useCallback((pageNumber: number) => {
    setViewMode('individual')
    setPendingScrollPage(pageNumber)
  }, [])

  // viewMode 가 individual 로 바뀐 직후 카드가 mount 되면 해당 페이지로 부드럽게 스크롤.
  useEffect(() => {
    if (viewMode !== 'individual' || pendingScrollPage === null) return
    const rafId = window.requestAnimationFrame(() => {
      const el = document.getElementById(`storyboard-page-${pendingScrollPage}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      setPendingScrollPage(null)
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [viewMode, pendingScrollPage])

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
      if (regenRemaining <= 0) return // 동화 한도 소진 — 호출 자체 차단.
      setRegeneratingPageNumber(pageNumber)
      // 이 페이지 이전 에러는 새 시도 시 리셋.
      setRegenerateErrors(prev => {
        if (!(pageNumber in prev)) return prev
        const next = { ...prev }
        delete next[pageNumber]
        return next
      })
      regenerateImageMut.mutate(
        { pageNumber, userPrompt },
        {
          onSuccess: res => {
            setCurrentImageJobId(res.jobId)
            setRegeneratePrompts(prev => ({ ...prev, [pageNumber]: '' }))
            // 카운터 SoT 는 BE — mutate 직후 status 캐시 invalidate 해 used+1 즉시 반영.
            // (PENDING/RUNNING 은 BE used 에 미포함이지만 이후 polling 종료 effect 에서 한 번 더 갱신.)
            if (storyId !== null) {
              void queryClient.invalidateQueries({
                queryKey: ['storyboard-regen-status', storyId],
              })
            }
            // regeneratingPageNumber 는 폴링이 끝날 때(아래 useEffect) 까지 유지 — 스피너 계속 노출.
          },
          onError: err => {
            // 한도 초과를 BE 에서 거부한 케이스 (`STORY_018`) 메시지 그대로 노출.
            setRegenerateErrors(prev => ({
              ...prev,
              [pageNumber]: err.message || '그림 재생성 요청에 실패했어요.',
            }))
            setRegeneratingPageNumber(null)
            // 한도 거부였을 가능성에 대비해 카운터 동기화.
            if (storyId !== null) {
              void queryClient.invalidateQueries({
                queryKey: ['storyboard-regen-status', storyId],
              })
            }
          },
        },
      )
    },
    [regenerateImageMut, regeneratePrompts, regenRemaining, queryClient, storyId],
  )

  /**
   * 드롭다운 picker 에서 다른 버전 선택 → BE 에 반영 + 페이지 캐시 갱신.
   * 동화 카운터에는 영향 없음 (선택은 카운트하지 않음).
   */
  const handleSelectVersion = useCallback(
    (pageNumber: number, version: number) => {
      if (storyId === null) return
      selectVersionMut.mutate(
        { pageNumber, version },
        {
          onSuccess: () => {
            // 페이지 imageUrl 갱신 → 카드 즉시 리렌더.
            void queryClient.refetchQueries({ queryKey: ['storyboard-pages', storyId] })
            // picker 의 current 표시도 갱신.
            void queryClient.invalidateQueries({
              queryKey: ['storyboard-image-versions', storyId, pageNumber],
            })
          },
        },
      )
    },
    [selectVersionMut, queryClient, storyId],
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
      <CreationHeader currentStep={4} />

      <div className="bookshelf-scroll">
        <main className="py-10 px-6 md:px-12 lg:px-24 xl:px-32 2xl:px-40 bookshelf-fade-in">
          <div className="max-w-7xl mx-auto pb-12">
            <StepTitleBlock
              stepNumber={4}
              title="스토리보드를 다듬어주세요"
              subtitle="한 페이지씩 글과 그림을 손봐 우리 가족만의 동화책으로 완성해보세요"
            />

            {/* 동화 단위 재생성 카운터 — 헤더 우측 위치. 한도 도달 시 빨간색 강조.
                pages 가 있는 경우에만 노출 (Step 4 본 화면). */}
            {pages.length > 0 && regenStatusQuery.data && (
              <div className="flex justify-end mb-4">
                <span
                  className={`inline-flex items-center gap-1.5 font-bold text-sm px-3 py-1.5 rounded-full border-2 shadow-sm ${
                    regenRemaining > 0
                      ? 'bg-[#E9DBBE] border-[#9A7548]/50 text-[#6B4A28]'
                      : 'bg-[#F8C8C7] border-[#a3413f] text-[#a3413f]'
                  }`}
                  title={
                    regenRemaining > 0
                      ? '이 동화에서 그림을 다시 그릴 수 있는 횟수예요.'
                      : '재생성 한도에 도달했어요. 더는 재생성할 수 없어요.'
                  }
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  그림 재생성 {regenUsed} / {regenLimit}
                </span>
              </div>
            )}

            {/* 보기 모드 토글 — 페이지가 있을 때만 노출.
                grid: 한 줄 3장 사진 갤러리. 사진 클릭 → individual 모드 + 해당 페이지로 스크롤.
                individual: 페이지마다 글/이미지/재생성 카드 (기본). */}
            {pages.length > 0 && (
              <div className="mb-6 flex justify-center">
                <div className="inline-flex bg-[#E9DBBE] border-2 border-[#9A7548]/40 rounded-full p-1 gap-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    aria-pressed={viewMode === 'grid'}
                    className={`px-5 py-2 rounded-full font-bold text-sm transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-[#3F6B2E] text-[#FFFFE5] shadow'
                        : 'text-[#6B4A28] hover:bg-[#9A7548]/10'
                    }`}
                  >
                    그림으로 한번에 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('individual')}
                    aria-pressed={viewMode === 'individual'}
                    className={`px-5 py-2 rounded-full font-bold text-sm transition-colors ${
                      viewMode === 'individual'
                        ? 'bg-[#3F6B2E] text-[#FFFFE5] shadow'
                        : 'text-[#6B4A28] hover:bg-[#9A7548]/10'
                    }`}
                  >
                    개별 페이지 보기
                  </button>
                </div>
              </div>
            )}

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
                      AI 가 페이지마다 한 장씩 그림을 그려요.
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

            {/* viewMode 분기:
                - grid: 한 줄 3장 사진 갤러리. 사진 클릭 → individual + 스크롤.
                - individual: 페이지마다 카드 (글 + 이미지 + 재생성). */}
            {pages.length > 0 && viewMode === 'grid' && (
              <PageGrid
                pages={pages}
                onSelect={handleSelectPageFromGrid}
              />
            )}

            {pages.length > 0 && viewMode === 'individual' && (
              <div className="space-y-4">
                {pages.map(page => (
                  <div
                    key={page.pageNumber}
                    id={`storyboard-page-${page.pageNumber}`}
                    style={{ scrollMarginTop: '24px' }}
                  >
                    <PageCard
                      storyId={storyId}
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
                      regenRemaining={regenRemaining}
                      regenLimit={regenLimit}
                      isRegeneratingThis={regeneratingPageNumber === page.pageNumber}
                      regenerateError={regenerateErrors[page.pageNumber] ?? null}
                      onSelectVersion={handleSelectVersion}
                      isSelectingVersion={selectVersionMut.isPending}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 진행 상태 배지 — 하단 푸터 위 (footer 가 좁아 중앙 status 는 footer 밖으로 분리). */}
            <div className="mt-8 flex justify-center">
              <div className={`font-bold flex items-center gap-2 px-5 py-2 rounded-full border-2 text-sm shadow-sm ${
                allImagesReady
                  ? 'bg-[#B9D38F]/40 border-[#3F6B2E] text-[#1F3318]'
                  : 'bg-[#E9DBBE] border-[#9A7548]/40 text-[#6B4A28]'
              }`}>
                <CheckCircle className="w-4 h-4" />
                <span>{allImagesReady ? '모든 그림이 준비됐어요' : '편집 진행 중'}</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      <CreationFooter
        currentStep={4}
        onBack={onBack}
        onNext={onNext}
        nextLabel="다음: 그림 스타일 선택"
      />
    </div>
  )
}

/**
 * 페이지 1장 카드 — 새 디자인 (스크린샷 기준 pastel forest 톤).
 *
 * 좌측: 이미지(또는 placeholder) + 버전 picker(있을 때) + "그림 다시 그리기" 입력/버튼.
 * 우측: 큰 따옴표 + 영어 본문(메인) + 한글 해석(textarea, blur 자동 저장).
 *
 * 동화 단위 한도(`regenRemaining`) 가 0 이면 input/button 모두 disable.
 * BE 가 versioned S3 key (`v{N}.png`) 로 저장하므로 cache-buster query 불필요 — page.imageUrl 그대로 사용.
 */
function PageCard(props: {
  storyId: number | null
  page: StoryboardPageItem
  draft: string
  onDraftChange: (value: string) => void
  onDraftBlur: () => void
  regeneratePrompt: string
  onRegeneratePromptChange: (value: string) => void
  onRegenerateImage: () => void
  regenerateDisabled: boolean
  patchPending: boolean
  /** 동화 단위 남은 재생성 횟수. 0 이면 모든 페이지 input/button disabled. */
  regenRemaining: number
  /** 동화 단위 한도 (UI 안내 문구에 사용). */
  regenLimit: number
  /** 이 페이지가 현재 재생성 요청 중 (mutate inflight 또는 폴링 중)인지. spinner 노출용. */
  isRegeneratingThis: boolean
  /** 이 페이지의 마지막 재생성 시도 에러 메시지. null 이면 표시 없음. */
  regenerateError: string | null
  /** 버전 선택 mutation handler. */
  onSelectVersion: (pageNumber: number, version: number) => void
  /** 선택 mutation 진행 중인지 (드롭다운 disable 용). */
  isSelectingVersion: boolean
}) {
  const {
    storyId,
    page,
    draft,
    onDraftChange,
    onDraftBlur,
    regeneratePrompt,
    onRegeneratePromptChange,
    onRegenerateImage,
    regenerateDisabled,
    patchPending,
    regenRemaining,
    regenLimit,
    isRegeneratingThis,
    regenerateError,
    onSelectVersion,
    isSelectingVersion,
  } = props

  // BE 가 versioned key (`stories/.../v{N}.png`) 로 저장 → URL 자체가 버전마다 달라
  // 브라우저 캐시 collision 없음. cache-buster query 불필요.
  const imageSrc = page.imageUrl ?? null

  const refineExhausted = regenRemaining <= 0
  const inputDisabled = regenerateDisabled || refineExhausted || isRegeneratingThis
  const buttonDisabled =
    regenerateDisabled ||
    refineExhausted ||
    isRegeneratingThis ||
    regeneratePrompt.trim().length === 0

  // 한글 해석 — 기본은 read-only 표시. "직접 편집" 클릭 시 textarea 로 전환.
  // blur 시 onDraftBlur (PATCH) + 표시 모드 복귀.
  const [editingKorean, setEditingKorean] = useState(false)
  const koreanText = draft.trim()

  return (
    <div className="bg-[#E9DBBE] rounded-2xl border-2 border-[#B9D38F]/55 shadow-[0_4px_14px_rgba(154,117,72,0.14)] overflow-hidden">
      {/* Header — Page 배지 + 저장 중 인디케이터 */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <span
          className="inline-flex items-center bg-[#B9D38F]/45 text-[#3F6B2E] font-bold px-3 py-1 rounded-full text-sm border border-[#3F6B2E]/40"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Page {page.pageNumber}
        </span>
        {patchPending && (
          <span className="text-[#9A7548] text-xs inline-flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> 저장 중
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 md:px-5 pb-4 md:pb-5">
        {/* ── 좌측: 이미지 + 재생성 ─────────────────────────── */}
        <div className="flex flex-col gap-2.5">
          {/* 이미지 영역 — 가로폭 대비 짧게 (4:3) 잡아 카드 높이 축소. */}
          <div className="aspect-[4/3] rounded-xl bg-[#B9D38F]/25 border border-[#B9D38F]/40 flex items-center justify-center overflow-hidden">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={`페이지 ${page.pageNumber} 그림`}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="text-center text-[#3F6B2E] p-4 max-w-[85%]">
                <ImageIcon className="w-9 h-9 mx-auto mb-2 opacity-60" />
                <p className="font-bold text-xs">아직 그림이 없어요</p>
                {page.sceneSummary && (
                  <p className="text-[11px] text-[#6B4A28] mt-1.5 italic line-clamp-2">
                    {page.sceneSummary}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 버전 picker — 재생성 이력이 있는 페이지에서만 표시. */}
          <VersionPicker
            storyId={storyId}
            pageNumber={page.pageNumber}
            disabled={isRegeneratingThis || regenerateDisabled || isSelectingVersion}
            onChange={version => onSelectVersion(page.pageNumber, version)}
          />

          {/* 재생성 UI — 사진 바로 밑. 입력 + 버튼. 동화 단위 카운터는 헤더에 있음. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[#3F6B2E] font-bold text-xs flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5" /> 그림 다시 그리기
              </label>
              <span
                className={`text-[11px] font-bold inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                  refineExhausted
                    ? 'text-[#9A7548]/70 border-[#9A7548]/30 bg-[#E9DBBE]/50'
                    : 'text-[#3F6B2E] border-[#3F6B2E]/30 bg-[#B9D38F]/25'
                }`}
                title="동화 단위 재생성 한도예요. 모든 페이지가 합산해 사용해요."
              >
                <RefreshCw className="w-2.5 h-2.5" />
                동화 전체 {regenRemaining} / {regenLimit} 남음
              </span>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={regeneratePrompt}
                onChange={e => onRegeneratePromptChange(e.target.value)}
                placeholder={
                  refineExhausted ? '재생성 횟수를 모두 사용했어요' : '예: 따뜻한 색감으로'
                }
                disabled={inputDisabled}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#9A7548]/40 bg-[#F4E4BC]/60 focus:border-[#3F6B2E] focus:bg-[#F4E4BC]/85 focus:outline-none text-xs text-[#3E2A18] placeholder-[#9A7548]/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
              <button
                type="button"
                onClick={onRegenerateImage}
                disabled={buttonDisabled}
                title={refineExhausted ? '재생성 횟수를 모두 사용했어요' : '그림 다시 그리기'}
                aria-label="그림 다시 그리기"
                className="bg-[#3F6B2E] text-[#FFFEF8] px-3 py-1.5 rounded-lg font-bold hover:bg-[#4F7B3E] transition-colors flex items-center gap-1 text-xs shadow-[0_2px_0_#1F3318] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {isRegeneratingThis ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            {/* 진행 중 안내 / 에러 메시지 — 페이지별 즉시 피드백. */}
            {isRegeneratingThis && (
              <p className="text-[11px] text-[#3F6B2E] inline-flex items-center gap-1.5 mt-0.5">
                <Loader2 className="w-3 h-3 animate-spin" /> 그림을 다시 그리는 중이에요…
              </p>
            )}
            {regenerateError && !isRegeneratingThis && (
              <p className="text-[11px] text-[#a3413f] inline-flex items-start gap-1.5 mt-0.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{regenerateError}</span>
              </p>
            )}
          </div>
        </div>

        {/* ── 우측: 큰 따옴표 + 영어 본문 + 한글 해석 (읽기/편집 토글) ── */}
        <div className="bg-[#F4E4BC]/85 rounded-xl p-4 md:p-5 flex flex-col border border-[#9A7548]/15">
          <Quote className="w-6 h-6 text-[#3F6B2E] opacity-70 mb-1.5" aria-hidden="true" />
          {/* 영어 본문 — 메인. 카드를 줄여도 본문은 잘 보이게 큰 사이즈 유지. */}
          <p className="text-[#3E2A18] text-lg md:text-xl leading-relaxed font-medium mb-4 whitespace-pre-wrap">
            {page.englishText?.trim() || '(영어 본문이 아직 없어요)'}
          </p>

          {/* 한글 해석 — 기본 read-only, "직접 편집" 클릭 시 textarea 전환 */}
          <div className="border-t border-[#9A7548]/25 pt-3 mt-auto">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[#9A7548] text-xs font-bold uppercase tracking-wide">
                한글 해석
              </span>
              {!editingKorean && (
                <button
                  type="button"
                  onClick={() => setEditingKorean(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#3F6B2E] hover:text-[#4F7B3E] bg-[#B9D38F]/30 hover:bg-[#B9D38F]/50 border border-[#3F6B2E]/30 px-2.5 py-1 rounded-full transition-colors"
                >
                  <Pencil className="w-3 h-3" /> 직접 편집
                </button>
              )}
            </div>
            {editingKorean ? (
              <textarea
                value={draft}
                onChange={e => onDraftChange(e.target.value)}
                onBlur={() => {
                  onDraftBlur()
                  setEditingKorean(false)
                }}
                autoFocus
                className="w-full min-h-[5rem] bg-[#FFF8E0] text-[#6B4A28] text-base md:text-lg leading-relaxed font-bold focus:outline-none resize-none placeholder-[#9A7548]/60 border-2 border-[#3F6B2E]/40 rounded-lg p-2.5"
                maxLength={4000}
                placeholder="한글 해석을 다듬어 주세요"
              />
            ) : (
              <p className="text-[#6B4A28] text-base md:text-lg leading-relaxed font-bold whitespace-pre-wrap min-h-[2.5rem]">
                {koreanText || (
                  <span className="text-[#9A7548]/60 font-normal italic">
                    한글 해석이 비어 있어요. "직접 편집" 을 눌러 입력해주세요.
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 한 줄에 3장씩 그림만 보여주는 갤러리. 사진 클릭 → onSelect(pageNumber) 로 individual 모드 전환.
 *
 * - 이미지 없는 페이지는 placeholder 표시 (썸네일 자리는 유지해서 페이지 번호 일관성 보존).
 * - 페이지 번호 배지를 좌상단에 띄워 "몇 페이지 사진인지" 즉시 파악 가능.
 */
function PageGrid({
  pages,
  onSelect,
}: {
  pages: StoryboardPageItem[]
  onSelect: (pageNumber: number) => void
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
      {pages.map(page => {
        // BE 가 versioned key 로 저장 → URL 마다 고유. cache-buster 불필요.
        const src = page.imageUrl ?? null
        return (
        <button
          key={page.pageNumber}
          type="button"
          onClick={() => onSelect(page.pageNumber)}
          title={`페이지 ${page.pageNumber} 편집`}
          aria-label={`페이지 ${page.pageNumber} 편집`}
          className="group relative aspect-square overflow-hidden rounded-2xl border-2 border-[#2a1b12] bg-[#e8ddb4] shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          {src ? (
            <img
              src={src}
              alt={`페이지 ${page.pageNumber} 그림`}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#8b7a52]">
              <ImageIcon className="w-10 h-10 opacity-50 mb-2" />
              <p className="text-sm font-bold">아직 그림 없음</p>
            </div>
          )}
          <span className="absolute top-2 left-2 inline-flex items-center justify-center bg-[#2d5a27]/90 text-[#f0e6c0] text-xs font-bold px-2.5 py-1 rounded-full border border-[#b4dc8c]/50 shadow-sm">
            페이지 {page.pageNumber}
          </span>
        </button>
        )
      })}
    </div>
  )
}

/**
 * 버전 picker — 한 페이지의 이미지 재생성 이력 dropdown.
 *
 * 동작:
 *  - `useStoryboardPageImageVersionsQuery` 로 versions 조회 (BE Redis SoT).
 *  - versions.length === 0 (= 재생성 이력 없음) 이면 picker 자체를 렌더하지 않음.
 *  - select onChange → 부모의 `onChange(version)` 호출. 부모가 select mutation 트리거 + 캐시 갱신.
 *
 * UX 정책:
 *  - 옵션 라벨: `v{N} · 첫 생성` (v1) / `v{N} · {prompt 일부}` (v2+) / `v{N}` (prompt null fallback).
 *  - current 가 선택된 상태로 표시. 같은 값을 선택해도 onChange 가 호출되지 않도록 controlled.
 *  - disabled: 부모가 progress 중이거나 select API 호출 중일 때 잠금.
 */
function VersionPicker({
  storyId,
  pageNumber,
  disabled,
  onChange,
}: {
  storyId: number | null
  pageNumber: number
  disabled: boolean
  onChange: (version: number) => void
}) {
  const versionsQuery = useStoryboardPageImageVersionsQuery(storyId, pageNumber)
  const data = versionsQuery.data
  if (!data || data.versions.length === 0) return null

  // version 내림차순으로 정렬 (BE 도 정렬해 내려오지만 안전망).
  const sorted: StoryboardImageVersionEntry[] = [...data.versions].sort(
    (a, b) => b.version - a.version,
  )
  const currentValue = data.current ?? sorted[0].version

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = parseInt(e.target.value, 10)
    if (!Number.isFinite(next) || next === currentValue) return
    onChange(next)
  }

  const formatLabel = (entry: StoryboardImageVersionEntry): string => {
    if (entry.version === 1) return `v1 · 첫 생성`
    const trimmed = entry.prompt?.trim()
    if (!trimmed) return `v${entry.version}`
    const head = trimmed.length > 18 ? trimmed.slice(0, 18) + '…' : trimmed
    return `v${entry.version} · ${head}`
  }

  return (
    <div className="flex items-center gap-1.5">
      <label
        className="text-[#3F6B2E] font-bold text-xs inline-flex items-center gap-1.5"
        htmlFor={`version-picker-${pageNumber}`}
      >
        <History className="w-3.5 h-3.5" /> 이전 버전
      </label>
      <select
        id={`version-picker-${pageNumber}`}
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#9A7548]/40 bg-[#F4E4BC]/60 text-xs text-[#3E2A18] focus:border-[#3F6B2E] focus:bg-[#F4E4BC]/85 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={`페이지 ${pageNumber} 이미지 버전 선택`}
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
