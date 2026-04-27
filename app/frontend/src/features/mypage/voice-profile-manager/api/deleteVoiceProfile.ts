import { deleteRequest } from '../../../../shared/api'

export function deleteVoiceProfile(voiceProfileId: number): Promise<void> {
  return deleteRequest<void>(`/voice-profiles/${voiceProfileId}`)
}
