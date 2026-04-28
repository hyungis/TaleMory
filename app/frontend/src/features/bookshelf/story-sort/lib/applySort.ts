import type { Story } from '../../../../entities/story'

export type SortKey = 'newest' | 'oldest' | 'name'

/**
 * 정렬 키 추출. createdAt(datetime) 가 있으면 그걸 우선 사용 — 같은 날짜라도 시간까지
 * 정확히 비교 가능. 없으면(dummy) date(YYYY-MM-DD) 로 fallback.
 */
function getSortTime(story: Story): number {
  const iso = story.createdAt ?? story.date
  return new Date(iso).getTime()
}

/**
 * 정렬 순수 함수. 원본은 새 배열을 반환 (불변성 유지).
 */
export function applySort(stories: Story[], sort: SortKey): Story[] {
  const copy = [...stories]
  switch (sort) {
    case 'newest':
      return copy.sort((a, b) => getSortTime(b) - getSortTime(a))
    case 'oldest':
      return copy.sort((a, b) => getSortTime(a) - getSortTime(b))
    case 'name':
      return copy.sort((a, b) => a.title.localeCompare(b.title))
  }
}
