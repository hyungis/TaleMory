import { get } from '../../../../shared/api'
import type { VoiceProfile } from '../../../../entities/voice-profile'
import { mapVoiceProfile, type VoiceProfileResponse } from './types'

const VOICE_PROFILES_ENDPOINT = '/v1/voice-profiles'

export async function getVoiceProfile(voiceProfileId: number): Promise<VoiceProfile> {
  const payload = await get<VoiceProfileResponse>(`${VOICE_PROFILES_ENDPOINT}/${voiceProfileId}`)
  return mapVoiceProfile(payload)
}
