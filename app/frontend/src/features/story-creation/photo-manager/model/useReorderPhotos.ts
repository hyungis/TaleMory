import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { orderPhotos } from '../api/orderPhotos'
import type { PhotoItemResponse } from '../api/types'

/**
 * 사진 순서 일괄 변경 mutation.
 *
 * 성공 시 서버가 재정렬된 전체 목록을 내려주므로 `setQueryData` 로 제자리 교체.
 * invalidate 하면 refetch 로 새 presigned URL 들이 내려와 `<img>` 가 깜빡일 수 있어 피함.
 */
export function useReorderPhotos(storyId: number | null) {
  const queryClient = useQueryClient()

  return useMutation<PhotoItemResponse[], ApiError, number[]>({
    mutationFn: (photoIds: number[]) => {
      if (storyId === null) {
        return Promise.reject(new Error('storyId 가 없습니다.'))
      }
      return orderPhotos(storyId, photoIds)
    },
    onSuccess: updated => {
      queryClient.setQueryData<PhotoItemResponse[]>(['photos', storyId], updated)
    },
  })
}
