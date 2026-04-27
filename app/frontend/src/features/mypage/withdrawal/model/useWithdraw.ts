import { useMutation } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { deleteMe } from '../api/deleteMe'

export function useWithdraw() {
  return useMutation<void, ApiError>({
    mutationFn: deleteMe,
  })
}
