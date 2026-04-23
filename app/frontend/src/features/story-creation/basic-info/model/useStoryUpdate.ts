import { useMutation } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { patchStory } from '../api/patchStory'
import type { ModifyStoryRequest, StoryCreateResponse } from '../api/types'

interface Variables {
  id: number
  body: ModifyStoryRequest
}

/**
 * 동화 기본 정보 수정 mutation — BasicInfoStep 재클릭 시 기존 DRAFT 를 업데이트.
 * POST 와 동일 응답(`{ storyId }`)을 반환하므로 상위 핸들러는 create/update 를 동일 API 로 처리 가능.
 */
export function useStoryUpdate() {
  return useMutation<StoryCreateResponse, ApiError, Variables>({
    mutationFn: ({ id, body }) => patchStory(id, body),
  })
}
