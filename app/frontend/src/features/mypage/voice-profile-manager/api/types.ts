import type { VoiceProfile } from '../../../../entities/voice-profile'

export interface VoiceProfileResponse {
  id?: number
  voiceProfileId?: number
  userId?: number
  title?: string
  audioUrl?: string | null
  ttsVoiceUrl?: string | null
}

export function mapVoiceProfile(payload: VoiceProfileResponse): VoiceProfile {
  return {
    id: typeof payload.voiceProfileId === 'number' ? payload.voiceProfileId : (payload.id ?? 0),
    userId: payload.userId ?? 0,
    title: typeof payload.title === 'string' ? payload.title : '',
    audioUrl: typeof payload.audioUrl === 'string' ? payload.audioUrl : '',
    ttsVoiceUrl: typeof payload.ttsVoiceUrl === 'string' ? payload.ttsVoiceUrl : undefined,
  }
}
