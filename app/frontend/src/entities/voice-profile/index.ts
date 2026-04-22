/**
 * Voice Profile 엔티티 — `voice_profiles` 테이블 대응.
 */

export interface VoiceProfile {
  id: number
  userId: number
  title: string
  audioUrl: string
  ttsVoiceUrl?: string
}
