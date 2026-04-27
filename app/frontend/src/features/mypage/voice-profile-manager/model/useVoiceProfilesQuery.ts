import { useQuery } from '@tanstack/react-query'
import type { VoiceProfile } from '../../../../entities/voice-profile'
import { getVoiceProfiles } from '../api/getVoiceProfiles'

export function useVoiceProfilesQuery(enabled = true) {
  return useQuery<VoiceProfile[]>({
    queryKey: ['voiceProfiles'],
    queryFn: getVoiceProfiles,
    enabled,
  })
}
