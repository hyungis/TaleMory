import { post } from '../../../../shared/api'

const VOICE_PROFILES_ENDPOINT = '/voice-profiles'

export interface VoicePreviewJobDto {
  previewId: string
  jobType: string
  status: string
}

/** POST /api/voice-profiles/{id}/preview — TTS 미리듣기 비동기 작업 시작 (202 Accepted) */
export function postVoicePreview(
  voiceProfileId: number,
  text: string,
  language: string = 'ko-KR',
): Promise<VoicePreviewJobDto> {
  return post<VoicePreviewJobDto>(`${VOICE_PROFILES_ENDPOINT}/${voiceProfileId}/preview`, {
    text,
    language,
  })
}
