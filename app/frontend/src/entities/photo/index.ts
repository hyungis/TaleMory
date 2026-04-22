/**
 * Photo 도메인 — `photo_album_items` 테이블 대응.
 */

export type PhotoPurpose = 'CHARACTER_REF' | 'STORYBOARD' | 'BOTH'

export interface Photo {
  id: number
  storyId: number
  imageUrl: string
  purpose: PhotoPurpose
  tags: string[]
}
