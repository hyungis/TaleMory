import type { Story } from '../../../../entities/story'

export type SortKey = 'newest' | 'oldest' | 'name'

/**
 * 정렬 키 추출. 우선순위: publishedAt → createdAt → date.
 *
 * 책장은 published 된 동화만 보여주므로 사용자가 인지하는 "최신" 은 "최근 출판한" 이다.
 * dummy / 미공개 케이스를 위해 createdAt → date 순으로 fallback.
 */
function getSortTime(story: Story): number {
  const iso = story.publishedAt ?? story.createdAt ?? story.date
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
