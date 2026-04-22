import { useCallback, useEffect, useState } from 'react'
import { MAX_GLOBAL_REFINE, MAX_PER_PAGE_REFINE } from '../lib/defaults'

export type StoryboardView = 'grid' | 'single'

export interface UseStoryboardEditorResult {
  view: StoryboardView
  setView: (view: StoryboardView) => void

  index: number
  setIndex: (idx: number) => void
  prev: () => void
  next: () => void

  previewIndex: number | null
  openPreview: (idx: number) => void
  closePreview: () => void
  /** Preview 에서 "이 페이지 자세히 보기" → single view + 해당 index 로 전환 */
  goToDetailFromPreview: () => void

  isGlobalRefineOpen: boolean
  openGlobalRefine: () => void
  closeGlobalRefine: () => void

  globalRefineRemaining: number
  /** 전체 수정 요청 (stub). 남은 횟수 감소 + 확인 alert. */
  submitGlobalRefine: (prompt: string) => boolean

  pageRefineRemaining: number[]
  /** 개별 페이지 재생성 (stub). 해당 인덱스의 남은 횟수 감소. */
  regeneratePage: (idx: number) => void
}

/**
 * STEP 04 스토리보드 에디터 상태 관리.
 *
 * - view/index: Grid/Single 전환, Single 뷰에서 prev/next 이동
 * - previewIndex: Grid 에서 클릭 시 열리는 미리보기 모달 인덱스 (null = 닫힘)
 * - globalRefineRemaining / pageRefineRemaining: AI 재생성 남은 횟수
 *
 * 실제 AI 호출은 stub(alert). 백엔드 AI 엔드포인트 연동 시 교체.
 */
export function useStoryboardEditor(pageCount: number): UseStoryboardEditorResult {
  const [view, setView] = useState<StoryboardView>('grid')
  const [index, setIndex] = useState(0)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [isGlobalRefineOpen, setIsGlobalRefineOpen] = useState(false)
  const [globalRefineRemaining, setGlobalRefineRemaining] = useState(MAX_GLOBAL_REFINE)
  const [pageRefineRemaining, setPageRefineRemaining] = useState<number[]>(() =>
    Array(pageCount).fill(MAX_PER_PAGE_REFINE),
  )

  // 페이지 수 변동 시 재생성 카운터 배열 길이 동기화
  useEffect(() => {
    setPageRefineRemaining(prev => {
      if (prev.length === pageCount) return prev
      const next = Array(pageCount).fill(MAX_PER_PAGE_REFINE)
      for (let i = 0; i < Math.min(prev.length, pageCount); i++) next[i] = prev[i]
      return next
    })
  }, [pageCount])

  const prev = useCallback(() => {
    setIndex(i => Math.max(0, i - 1))
  }, [])

  const next = useCallback(() => {
    setIndex(i => Math.min(pageCount - 1, i + 1))
  }, [pageCount])

  const openPreview = useCallback((idx: number) => setPreviewIndex(idx), [])
  const closePreview = useCallback(() => setPreviewIndex(null), [])

  const goToDetailFromPreview = useCallback(() => {
    setPreviewIndex(cur => {
      if (cur !== null) {
        setIndex(cur)
        setView('single')
      }
      return null
    })
  }, [])

  const openGlobalRefine = useCallback(() => setIsGlobalRefineOpen(true), [])
  const closeGlobalRefine = useCallback(() => setIsGlobalRefineOpen(false), [])

  const submitGlobalRefine = useCallback(
    (prompt: string): boolean => {
      const val = prompt.trim()
      if (!val) {
        alert('수정 요청 내용을 입력해 주세요.')
        return false
      }
      if (globalRefineRemaining <= 0) {
        alert('전체 수정 가능 횟수를 모두 사용했어요.')
        return false
      }
      setGlobalRefineRemaining(n => n - 1)
      alert(
        `AI에게 수정 요청을 보냈어요!\n\n요청 내용: ${val}\n남은 횟수: ${globalRefineRemaining - 1} / ${MAX_GLOBAL_REFINE}`,
      )
      setIsGlobalRefineOpen(false)
      return true
    },
    [globalRefineRemaining],
  )

  const regeneratePage = useCallback((idx: number) => {
    setPageRefineRemaining(prev => {
      if ((prev[idx] ?? 0) <= 0) return prev
      const next = [...prev]
      next[idx] = next[idx] - 1
      alert(`Page ${idx + 1}의 그림을 새로 그렸어요! (남은 횟수: ${next[idx]}/${MAX_PER_PAGE_REFINE})`)
      return next
    })
  }, [])

  return {
    view,
    setView,
    index,
    setIndex,
    prev,
    next,
    previewIndex,
    openPreview,
    closePreview,
    goToDetailFromPreview,
    isGlobalRefineOpen,
    openGlobalRefine,
    closeGlobalRefine,
    globalRefineRemaining,
    submitGlobalRefine,
    pageRefineRemaining,
    regeneratePage,
  }
}
