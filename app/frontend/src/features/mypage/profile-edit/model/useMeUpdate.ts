import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import type { UserProfile } from '../../../../entities/user'
import { patchMe } from '../api/patchMe'
import type { UpdateMeRequest } from '../api/types'

export function useMeUpdate() {
  const queryClient = useQueryClient()

  return useMutation<UserProfile, ApiError, UpdateMeRequest>({
    mutationFn: patchMe,
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user)
    },
  })
}
