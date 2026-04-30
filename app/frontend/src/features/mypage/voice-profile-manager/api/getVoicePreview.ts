import { get } from '../../../../shared/api'

const VOICE_PROFILES_ENDPOINT = '/voice-profiles'

export interface VoicePreviewStatusDto {
  previewId: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  audioUrl: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  finishedAt: string | null
}

/** GET /api/voice-profiles/previews/{previewId} — 미리듣기 잡 상태 폴링 */
export function getVoicePreview(previewId: string): Promise<VoicePreviewStatusDto> {
  return get<VoicePreviewStatusDto>(`${VOICE_PROFILES_ENDPOINT}/previews/${previewId}`)
}
