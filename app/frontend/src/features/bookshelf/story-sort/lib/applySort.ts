import type { Story } from '../../../../entities/story'

export type SortKey = 'newest' | 'oldest' | 'name'

/**
 * 정렬 순수 함수. 원본은 새 배열을 반환 (불변성 유지).
 */
export function applySort(stories: Story[], sort: SortKey): Story[] {
  const copy = [...stories]
  switch (sort) {
    case 'newest':
      return copy.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    case 'oldest':
      return copy.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    case 'name':
      return copy.sort((a, b) => a.title.localeCompare(b.title))
  }
}
