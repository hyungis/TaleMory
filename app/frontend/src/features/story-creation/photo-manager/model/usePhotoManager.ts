import { useCallback, useState } from 'react'
import type { DraftPhoto } from '../../model/types'

export const MAX_PHOTOS = 30

export interface UsePhotoManagerResult {
  photos: DraftPhoto[]
  addFiles: (files: FileList | File[]) => void
  removePhoto: (id: string) => void
  updatePhoto: (id: string, patch: Partial<Pick<DraftPhoto, 'name' | 'description' | 'tags'>>) => void
  canAddMore: boolean
}

/**
 * 사진 업로드 + 편집 상태 관리.
 * 현재 URL 은 `URL.createObjectURL` 로 브라우저 메모리 blob url — 새로고침 시 휘발.
 * 실제 S3 업로드는 후속 API 연동 커밋에서 추가.
 */
export function usePhotoManager(initial: DraftPhoto[] = []): UsePhotoManagerResult {
  const [photos, setPhotos] = useState<DraftPhoto[]>(initial)

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files)
    setPhotos(prev => {
      const remaining = MAX_PHOTOS - prev.length
      const accepted = list
        .filter(f => f.type.startsWith('image/'))
        .slice(0, Math.max(0, remaining))
        .map<DraftPhoto>(file => ({
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url: URL.createObjectURL(file),
          name: file.name,
          description: '',
          tags: '',
        }))
      return [...prev, ...accepted]
    })
  }, [])

  const removePhoto = useCallback((id: string) => {
    setPhotos(prev => {
      const target = prev.find(p => p.id === id)
      if (target?.url.startsWith('blob:')) URL.revokeObjectURL(target.url)
      return prev.filter(p => p.id !== id)
    })
  }, [])

  const updatePhoto = useCallback(
    (id: string, patch: Partial<Pick<DraftPhoto, 'name' | 'description' | 'tags'>>) => {
      setPhotos(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
    },
    [],
  )

  return {
    photos,
    addFiles,
    removePhoto,
    updatePhoto,
    canAddMore: photos.length < MAX_PHOTOS,
  }
}
