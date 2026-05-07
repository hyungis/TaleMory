import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import type { PersonId } from '../../../../shared/types'
import type { Person } from '../../../../entities/person'
import { patchPerson } from '../api/patchPerson'
import type { UpdatePersonRequest } from '../api/types'

interface UpdatePersonVariables {
  personId: PersonId
  body: UpdatePersonRequest
}

export function usePersonUpdate(userId: number) {
  const queryClient = useQueryClient()

  return useMutation<Person, ApiError, UpdatePersonVariables>({
    mutationFn: ({ personId, body }) => patchPerson(userId, personId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mypagePersons', userId] })
    },
  })
}
