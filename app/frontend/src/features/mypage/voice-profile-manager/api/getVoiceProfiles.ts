import { get } from '../../../../shared/api'
import type { VoiceProfile } from '../../../../entities/voice-profile'
import { mapVoiceProfile, type VoiceProfileResponse } from './types'

const VOICE_PROFILES_ENDPOINT = '/voice-profiles'

export async function getVoiceProfiles(): Promise<VoiceProfile[]> {
  const payload = await get<VoiceProfileResponse[]>(VOICE_PROFILES_ENDPOINT)
  return payload.map(mapVoiceProfile)
}
