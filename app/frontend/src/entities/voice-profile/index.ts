/**
 * Voice Profile 엔티티 — `voice_profiles` 테이블 대응.
 */
import type { VoiceProfileId } from '../../shared/types'

export interface VoiceProfile {
  id: VoiceProfileId
  userId: number
  title: string
  audioUrl: string
  ttsVoiceUrl?: string
  createdAt?: string
  updatedAt?: string
}
