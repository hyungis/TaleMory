import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { orderPhotos } from '../api/orderPhotos'
import type { PhotoItemResponse } from '../api/types'

/**
 * 사진 순서 일괄 변경 mutation.
 *
 * 낙관적 업데이트:
 *  - dnd-kit 드롭 직후 곧바로 캐시를 새 순서로 갈아치워서 서버 응답을 기다리는 동안
 *    드래그한 사진이 원래 위치로 튕겼다가 다시 이동하는 플래시를 방지.
 *  - 실패 시 onError 가 이전 스냅샷으로 되돌려 일관성 보장.
 *  - 성공 시 onSuccess 가 서버가 내려준 권위 응답으로 교체 (displayOrder 등 정확화).
 *
 * invalidate 가 아닌 setQueryData 사용: 새 presigned URL 들이 다시 발급되며 `<img>` 가
 * 깜빡일 수 있어 피함 — 서버가 내려준 imageUrl 그대로 캐시에 박는다.
 */
export function useReorderPhotos(storyId: number | null) {
  const queryClient = useQueryClient()

  return useMutation<PhotoItemResponse[], ApiError, number[], { previous?: PhotoItemResponse[] }>({
    mutationFn: (photoIds: number[]) => {
      if (storyId === null) {
        return Promise.reject(new Error('storyId 가 없습니다.'))
      }
      return orderPhotos(storyId, photoIds)
    },
    onMutate: async (photoIds) => {
      await queryClient.cancelQueries({ queryKey: ['photos', storyId] })
      const previous = queryClient.getQueryData<PhotoItemResponse[]>(['photos', storyId])
      if (previous) {
        // 입력된 photoIds 순서대로 로컬 캐시 재배열 (낙관적).
        const byId = new Map(previous.map(p => [p.photoId, p]))
        const reordered = photoIds
          .map(id => byId.get(id))
          .filter((p): p is PhotoItemResponse => p !== undefined)
        queryClient.setQueryData(['photos', storyId], reordered)
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['photos', storyId], context.previous)
      }
    },
    onSuccess: updated => {
      queryClient.setQueryData<PhotoItemResponse[]>(['photos', storyId], updated)
    },
  })
}
