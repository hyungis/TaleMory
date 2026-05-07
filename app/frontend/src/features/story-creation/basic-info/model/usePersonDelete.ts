import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import type { PersonId } from '../../../../shared/types'
import { deletePerson } from '../api/deletePerson'

/** DELETE /api/persons/{id} (soft delete) mutation. 성공 시 persons 쿼리 invalidate. */
export function usePersonDelete() {
  const queryClient = useQueryClient()
  return useMutation<void, ApiError, PersonId>({
    mutationFn: deletePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] })
    },
  })
}
