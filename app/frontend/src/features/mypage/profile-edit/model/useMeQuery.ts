import { useQuery } from '@tanstack/react-query'
import { getMe } from '../api/getMe'
import type { UserProfile } from '../../../../entities/user'

export function useMeQuery(enabled = true) {
  return useQuery<UserProfile>({
    queryKey: ['me'],
    queryFn: getMe,
    enabled,
  })
}
