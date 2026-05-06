import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { patchPhoto } from '../api/patchPhoto'
import type { ModifyPhotoRequest, PhotoItemResponse } from '../api/types'

interface Variables {
  photoId: number
  body: ModifyPhotoRequest
}

/**
 * 사진 설명/태그 수정 mutation.
 *
 * 성공 시 `['photos', storyId]` 캐시의 해당 항목만 제자리 교체 (setQueryData).
 * invalidate 로 리스트 전체를 refetch 하면 모든 `<img>` 가 새 presigned URL 로 교체돼
 * 화면이 깜빡이는 UX 가 생김 → 해당 하나만 부분 업데이트.
 */
export function useUpdatePhoto(storyId: number | null) {
  const queryClient = useQueryClient()

  return useMutation<PhotoItemResponse, ApiError, Variables>({
    mutationFn: ({ photoId, body }) => {
      if (storyId === null) {
        return Promise.reject(new Error('storyId 가 없습니다.'))
      }
      return patchPhoto(storyId, photoId, body)
    },
    onSuccess: updated => {
      queryClient.setQueryData<PhotoItemResponse[]>(['photos', storyId], old =>
        old?.map(p => (p.photoId === updated.photoId ? updated : p)) ?? old,
      )
    },
  })
}
