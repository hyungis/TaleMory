import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { deletePerson } from '../api/deletePerson'

export function usePersonDelete(userId: number) {
  const queryClient = useQueryClient()

  return useMutation<void, ApiError, number>({
    mutationFn: deletePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mypagePersons', userId] })
    },
  })
}
