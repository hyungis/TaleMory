import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import type { PersonId } from '../../../../shared/types'
import { patchPerson } from '../api/patchPerson'
import type { ModifyPersonRequest, PersonResponse } from '../api/types'

export interface UsePersonUpdateVariables {
  id: PersonId
  body: ModifyPersonRequest
}

/** PATCH /api/persons/{id} mutation. 성공 시 persons 쿼리 invalidate. */
export function usePersonUpdate() {
  const queryClient = useQueryClient()
  return useMutation<PersonResponse, ApiError, UsePersonUpdateVariables>({
    mutationFn: ({ id, body }) => patchPerson(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] })
    },
  })
}
