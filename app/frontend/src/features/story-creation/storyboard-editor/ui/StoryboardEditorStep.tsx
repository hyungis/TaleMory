import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ImageIcon,
  Loader2,
  RefreshCw,
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
import { useGenerationJobQuery } from '../../storyboard-prompt'

interface StoryboardEditorStepProps {
  storyId: number | null
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
export function StoryboardEditorStep({ storyId, onBack, onNext }: StoryboardEditorStepProps) {
  const queryClient = useQueryClient()

  const pagesQuery = useStoryboardPagesQuery(storyId)
  const patchMut = useStoryboardPagePatch(storyId)
  const generateImagesMut = useGenerateStoryboardImagesPost(storyId)
  const regenerateImageMut = useRegenerateStoryboardImagePost(storyId)

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

  // 잡 마무리(SUCCESS/FAILED/타임아웃) 처리.
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

            {/* 페이지 카드 list */}
            {pagesQuery.isLoading && (
              <div className="bg-[#f0e6c0] rounded-2xl border-2 border-[#2a1b12] p-10 text-center">
                <Loader2 className="w-10 h-10 text-[#2d5a27] animate-spin mx-auto mb-4" />
                <p className="text-[#2d5a27] font-bold">페이지를 불러오는 중...</p>
              </div>
            )}

            {!pagesQuery.isLoading && pages.length === 0 && (
              <div className="bg-[#f0e6c0] rounded-2xl border-2 border-[#2a1b12] p-10 text-center">
                <p className="text-[#2d5a27] font-bold mb-2">아직 줄거리가 만들어지지 않았어요</p>
                <p className="text-[#8b7a52]">이전 단계에서 줄거리를 먼저 만들어주세요.</p>
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
