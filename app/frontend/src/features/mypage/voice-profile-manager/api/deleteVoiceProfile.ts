import { deleteRequest } from '../../../../shared/api'

const VOICE_PROFILES_ENDPOINT = '/voice-profiles'

export function deleteVoiceProfile(voiceProfileId: number): Promise<void> {
  return deleteRequest<void>(`${VOICE_PROFILES_ENDPOINT}/${voiceProfileId}`)
}
