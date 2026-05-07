import { deleteRequest } from '../../../../shared/api'
import type { VoiceProfileId } from '../../../../shared/types'

const VOICE_PROFILES_ENDPOINT = '/voice-profiles'

export function deleteVoiceProfile(voiceProfileId: VoiceProfileId): Promise<void> {
  return deleteRequest<void>(`${VOICE_PROFILES_ENDPOINT}/${voiceProfileId}`)
}
