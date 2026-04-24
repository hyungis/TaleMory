import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { postPerson } from '../api/postPerson'
import type { CreatePersonRequest, PersonResponse } from '../api/types'

/**
 * 인물 신규 등록 mutation.
 * 성공 시 `['persons']` 쿼리 전체를 invalidate 해 드롭다운 목록 자동 갱신.
 */
export function usePersonPost() {
  const queryClient = useQueryClient()
  return useMutation<PersonResponse, ApiError, CreatePersonRequest>({
    mutationFn: postPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] })
    },
  })
}
