import type { VoiceProfile } from '../../../../entities/voice-profile'
import type { VoiceProfileId } from '../../../../shared/types'

export interface VoiceProfileResponse {
  id?: VoiceProfileId
  voiceProfileId?: VoiceProfileId
  userId?: number
  title?: string
  audioUrl?: string | null
  ttsVoiceUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

export function mapVoiceProfile(payload: VoiceProfileResponse): VoiceProfile {
  return {
    id: typeof payload.voiceProfileId === 'string' ? payload.voiceProfileId : (payload.id ?? ''),
    userId: payload.userId ?? 0,
    title: typeof payload.title === 'string' ? payload.title : '',
    audioUrl: typeof payload.audioUrl === 'string' ? payload.audioUrl : '',
    ttsVoiceUrl: typeof payload.ttsVoiceUrl === 'string' ? payload.ttsVoiceUrl : undefined,
    createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : undefined,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined,
  }
}
