import { useCallback, useMemo, useState } from 'react'
import type { Story, StoryLevel } from '../../../entities/story'
import { applySort, type SortKey } from '../story-sort'

export const ITEMS_PER_PAGE = 8

export interface UseBookshelfResult {
  /** 필터 + 정렬이 모두 적용된 결과 (전체 페이지 합본). */
  filtered: Story[]
  /** 현재 페이지에 해당하는 책 목록. */
  paged: Story[]
  activeFilters: StoryLevel[]
  toggleFilter: (level: StoryLevel) => void
  sort: SortKey
  updateSort: (sort: SortKey) => void
  page: number
  setPage: (page: number) => void
  totalPages: number
}

/**
 * Bookshelf 모달의 필터/정렬/페이지네이션 state machine.
 *
 * 책임:
 *  - level 다중 필터 (빈 배열 = 전체)
 *  - sort key 선택
 *  - 페이지 인덱스 관리
 *  - 필터/정렬 변경 시 자동으로 1페이지로 리셋 (원본과 동일)
 *
 * 외부에는 파생값(filtered, paged, totalPages) + 조작 API만 노출.
 */
export function useBookshelf(stories: Story[]): UseBookshelfResult {
  const [activeFilters, setActiveFilters] = useState<StoryLevel[]>([])
  const [sort, setSort] = useState<SortKey>('newest')
  const [page, setPage] = useState(1)

  const toggleFilter = useCallback((level: StoryLevel) => {
    setActiveFilters(prev =>
      prev.includes(level) ? prev.filter(f => f !== level) : [...prev, level],
    )
    setPage(1)
  }, [])

  const updateSort = useCallback((next: SortKey) => {
    setSort(next)
    setPage(1)
  }, [])

  const filtered = useMemo(() => {
    const filteredList = stories.filter(
      s => activeFilters.length === 0 || activeFilters.includes(s.level),
    )
    return applySort(filteredList, sort)
  }, [stories, activeFilters, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))

  const paged = useMemo(
    () => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [filtered, page],
  )

  return {
    filtered,
    paged,
    activeFilters,
    toggleFilter,
    sort,
    updateSort,
    page,
    setPage,
    totalPages,
  }
}
