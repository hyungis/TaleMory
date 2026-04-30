import { patch } from '../../../shared/api/client'

export function patchBookmark(storyId: number, isBookmarked: boolean): Promise<void> {
  return patch<void>(`/stories/${storyId}/bookmark`, { isBookmarked })
}
