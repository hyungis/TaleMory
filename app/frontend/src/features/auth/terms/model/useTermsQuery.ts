import { useQuery } from '@tanstack/react-query'
import { getTerms } from '../api/getTerms'

interface UseTermsQueryOptions {
  enabled?: boolean
}

export function useTermsQuery({ enabled = true }: UseTermsQueryOptions = {}) {
  return useQuery({
    queryKey: ['auth', 'terms'],
    queryFn: getTerms,
    enabled,
    staleTime: Infinity,
  })
}
