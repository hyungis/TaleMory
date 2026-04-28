import { post, get, deleteRequest } from '../../../../shared/api/client'

const VOICE_PROFILE_ENDPOINT = '/v1/voice-profiles'
const VOICE_RECORDING_SCRIPT_ENDPOINT = '/v1/voice-recording-script'

export interface VoicePresignDto {
  uploadUrl: string
  s3Key: string
  expiresAt: string
}

export interface VoiceProfileDto {
  voiceProfileId: number
  userId: number
  title: string
  audioUrl: string | null
  ttsVoiceUrl: string | null
  createdAt: string
  updatedAt: string
}

/** Phase 1: POST /api/v1/voice-profiles/presigned-url — presigned PUT URL 발급 (DB 저장 없음) */
export async function presignVoiceUpload(
  contentType: string = 'audio/webm',
): Promise<VoicePresignDto> {
  return post<VoicePresignDto>(`${VOICE_PROFILE_ENDPOINT}/presigned-url`, { contentType })
}

/** Phase 2: presigned URL로 S3에 직접 업로드 */
export async function uploadAudioToS3(uploadUrl: string, audioBlob: Blob): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
    body: audioBlob,
  })
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`)
}

/** Phase 3: POST /api/v1/voice-profiles — S3 업로드 완료 후 DB commit */
export async function commitVoiceProfile(
  title: string,
  s3Key: string,
): Promise<VoiceProfileDto> {
  return post<VoiceProfileDto>(VOICE_PROFILE_ENDPOINT, { title, s3Key })
}

/** GET /api/v1/voice-profiles — 내 보이스 프로필 목록 */
export async function getVoiceProfiles(): Promise<VoiceProfileDto[]> {
  return get<VoiceProfileDto[]>(VOICE_PROFILE_ENDPOINT)
}

/** DELETE /api/v1/voice-profiles/{id} */
export async function deleteVoiceProfile(voiceProfileId: number): Promise<void> {
  return deleteRequest<void>(`${VOICE_PROFILE_ENDPOINT}/${voiceProfileId}`)
}

interface RecordingScriptResponse {
  script: string
}

/** GET /api/v1/voice-recording-script?storyId={id} — 아이 이름이 주입된 녹음 스크립트 */
export async function getRecordingScript(storyId?: number | null): Promise<string> {
  const query = storyId ? `?storyId=${storyId}` : ''
  const res = await get<RecordingScriptResponse>(`${VOICE_RECORDING_SCRIPT_ENDPOINT}${query}`)
  return res.script
}
