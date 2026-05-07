/**
 * Photo 도메인 — `photo_album_items` 테이블 대응.
 */
import type { PhotoId, StoryId } from '../../shared/types'

export type PhotoPurpose = 'CHARACTER_REF' | 'STORYBOARD' | 'BOTH'

export interface Photo {
  id: PhotoId
  storyId: StoryId
  imageUrl: string
  purpose: PhotoPurpose
  tags: string[]
}
