import { useMutation } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { postStory } from '../api/postStory'
import type { CreateStoryRequest, StoryCreateResponse } from '../api/types'

/**
 * 동화 기본 정보 생성 mutation (BasicInfoStep 종료 시 호출).
 * 성공 시 반환 `storyId` 를 상위에서 `useStoryCreationFlow.setStoryId()` 에 저장.
 * 별도 cache invalidate 는 하지 않는다 (새 리소스 생성이라 목록 쿼리는 다른 스코프).
 */
export function useStoryPost() {
  return useMutation<StoryCreateResponse, ApiError, CreateStoryRequest>({
    mutationFn: postStory,
  })
}
