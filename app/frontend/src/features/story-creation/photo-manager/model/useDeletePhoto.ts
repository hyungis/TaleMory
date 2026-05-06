import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { deletePhoto } from '../api/deletePhoto'

/**
 * 사진 삭제 mutation. 성공 시 해당 story 의 사진 목록 쿼리를 invalidate 해 UI 자동 갱신.
 */
export function useDeletePhoto(storyId: number | null) {
  const queryClient = useQueryClient()

  return useMutation<void, ApiError, number>({
    mutationFn: (photoId: number) => {
      if (storyId === null) {
        return Promise.reject(new Error('storyId 가 없습니다.'))
      }
      return deletePhoto(storyId, photoId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', storyId] })
    },
  })
}
