import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PhotoId, StoryId } from '../../../../shared/types'
import { toggleCharacterRef } from '../api/toggleCharacterRef'
import type { PhotoItemResponse } from '../api/types'

interface ToggleVars {
  photoId: PhotoId
  on: boolean
}

/**
 * 추억 사진 카드의 별 토글 mutation 훅.
 *
 * 성공 시 `['photos', storyId]` 캐시를 invalidate 해 list 가 최신 purpose 로 갱신되게 한다.
 * BE 가 응답으로 갱신된 PhotoItemResponse 를 돌려주지만, 다른 사진의 카운트 변화도 반영해야 하므로
 * setQueryData 보다 invalidate 가 안전.
 *
 * 호출자 측 책임:
 *  - storyId null 가드 (이 훅은 storyId 가 보장됐을 때만 호출).
 *  - 에러 처리 (lock=409 STORY_021, max-3=400 STORY_020 등) — toast / banner 등으로.
 */
export function useCharacterRefTogglePut(storyId: StoryId | null) {
  const queryClient = useQueryClient()
  return useMutation<PhotoItemResponse, unknown, ToggleVars>({
    mutationFn: ({ photoId, on }) => {
      if (storyId === null) {
        throw new Error('storyId 가 없습니다.')
      }
      return toggleCharacterRef(storyId, photoId, { on })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', storyId] })
    },
  })
}
