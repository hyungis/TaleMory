import { apiClient } from '../../../shared/api'
import type { ShareLinkApiResponse, StoryApiResponse } from './types'

/** 내 동화 목록 조회 */
export function getMyStories(): Promise<StoryApiResponse[]> {
  return apiClient<StoryApiResponse[]>('/stories')
}

/** 동화 삭제 (soft delete) */
export function deleteStoryById(storyId: number): Promise<void> {
  return apiClient<void>(`/stories/${storyId}`, { method: 'DELETE' })
}

/** 동화 공개(출판) */
export function publishStory(storyId: number): Promise<ShareLinkApiResponse> {
  return apiClient<ShareLinkApiResponse>(`/stories/${storyId}/publish`, { method: 'POST' })
}

/** 공유 링크 조회 */
export function getShareLink(storyId: number): Promise<ShareLinkApiResponse> {
  return apiClient<ShareLinkApiResponse>(`/stories/${storyId}/share-link`)
}
