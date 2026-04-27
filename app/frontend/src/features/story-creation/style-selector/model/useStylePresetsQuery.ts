import { useQuery } from '@tanstack/react-query'
import { getStylePresets } from '../api/getStylePresets'

export function useStylePresetsQuery() {
  return useQuery({
    queryKey: ['style-presets'],
    queryFn: getStylePresets,
    staleTime: Infinity,
  })
}
