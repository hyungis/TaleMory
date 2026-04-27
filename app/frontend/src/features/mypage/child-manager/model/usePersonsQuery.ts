import { useQuery } from '@tanstack/react-query'
import type { Person } from '../../../../entities/person'
import { getPersons } from '../api/getPersons'

export function usePersonsQuery(userId: number) {
  return useQuery<Person[]>({
    queryKey: ['mypagePersons', userId],
    queryFn: () => getPersons(userId),
    enabled: userId > 0,
  })
}
