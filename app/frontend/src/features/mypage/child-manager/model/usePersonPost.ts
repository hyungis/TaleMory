import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import type { Person } from '../../../../entities/person'
import { postPerson } from '../api/postPerson'
import type { CreatePersonRequest } from '../api/types'

export function usePersonPost(userId: number) {
  const queryClient = useQueryClient()

  return useMutation<Person, ApiError, CreatePersonRequest>({
    mutationFn: (body) => postPerson(userId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mypagePersons', userId] })
    },
  })
}
