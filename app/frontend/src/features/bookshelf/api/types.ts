import type { StoryId } from '../../../shared/types'

/** GET /api/stories 응답 아이템 */
export interface StoryApiResponse {
  id: StoryId
  title: string | null
  difficulty: string
  /** "VIEWER" | "WEBTOON" */
  mode: string
  status: string
  isBookmarked: boolean
  travelPlace: string | null
  travelStartDate: string | null
  travelEndDate: string | null
  publishedAt: string | null
  createdAt: string
  sceneCount: number
  coverImageUrl: string | null
  shareToken: string | null
}

/** GET /api/stories/{id}/share-link 응답 */
export interface ShareLinkApiResponse {
  shareToken: string
  shareUrl: string
}
