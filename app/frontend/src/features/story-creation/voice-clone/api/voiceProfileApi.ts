import { post, get, deleteRequest } from '../../../../shared/api/client'

export interface VoiceProfileDto {
  voiceProfileId: number
  userId: number
  title: string
  audioUrl: string | null
  ttsVoiceUrl: string | null
  createdAt: string
  updatedAt: string
  uploadUrl?: string | null
}

/** POST /api/voice-profiles — DB 저장 + presigned PUT URL 발급 */
export async function createVoiceProfile(
  title: string,
  contentType: string = 'audio/webm',
): Promise<VoiceProfileDto> {
  return post<VoiceProfileDto>('/voice-profiles', { title, contentType })
}

/** presigned URL로 S3에 직접 업로드 */
export async function uploadAudioToS3(uploadUrl: string, audioBlob: Blob): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
    body: audioBlob,
  })
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`)
}

/** GET /api/voice-profiles — 내 보이스 프로필 목록 */
export async function getVoiceProfiles(): Promise<VoiceProfileDto[]> {
  return get<VoiceProfileDto[]>('/voice-profiles')
}

/** DELETE /api/voice-profiles/{id} */
export async function deleteVoiceProfile(voiceProfileId: number): Promise<void> {
  return deleteRequest<void>(`/voice-profiles/${voiceProfileId}`)
}

interface RecordingScriptResponse {
  script: string
}

/** GET /api/voice-recording-script?storyId={id} — 아이 이름이 주입된 녹음 스크립트 */
export async function getRecordingScript(storyId?: number | null): Promise<string> {
  const query = storyId ? `?storyId=${storyId}` : ''
  const res = await get<RecordingScriptResponse>(`/voice-recording-script${query}`)
  return res.script
}
