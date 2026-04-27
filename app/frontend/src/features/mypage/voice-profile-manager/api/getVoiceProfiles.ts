import { get } from '../../../../shared/api'
import type { VoiceProfile } from '../../../../entities/voice-profile'
import { mapVoiceProfile, type VoiceProfileResponse } from './types'

export async function getVoiceProfiles(): Promise<VoiceProfile[]> {
  const payload = await get<VoiceProfileResponse[]>('/voice-profiles')
  return payload.map(mapVoiceProfile)
}
