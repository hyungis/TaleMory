import { useQuery } from '@tanstack/react-query'
import type { VoiceProfile } from '../../../../entities/voice-profile'
import { getVoiceProfile } from '../api/getVoiceProfile'

export function useVoiceProfileQuery(voiceProfileId: number | null, enabled = true) {
  return useQuery<VoiceProfile>({
    queryKey: ['voiceProfile', voiceProfileId],
    queryFn: () => getVoiceProfile(voiceProfileId ?? 0),
    enabled: enabled && voiceProfileId !== null && voiceProfileId > 0,
  })
}
