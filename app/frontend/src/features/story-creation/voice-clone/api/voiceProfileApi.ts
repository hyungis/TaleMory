import type { StoryId, VoiceProfileId } from '../../../../shared/types'
import { post, get, put, patch, deleteRequest } from '../../../../shared/api/client'

const VOICE_PROFILE_ENDPOINT = '/voice-profiles'
const VOICE_RECORDING_SCRIPT_ENDPOINT = '/voice-recording-script'

export interface VoicePresignDto {
  uploadUrl: string
  s3Key: string
  expiresAt: string
}

export interface VoiceProfileDto {
  voiceProfileId: VoiceProfileId
  userId: number
  title: string
  audioUrl: string | null
  ttsVoiceUrl: string | null
  createdAt: string
  updatedAt: string
}

/** Phase 1: POST /api/voice-profiles/presigned-url — presigned PUT URL 발급 (DB 저장 없음) */
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

/** Phase 3: POST /api/voice-profiles — S3 업로드 완료 후 DB commit */
export async function commitVoiceProfile(
  title: string,
  s3Key: string,
): Promise<VoiceProfileDto> {
  return post<VoiceProfileDto>(VOICE_PROFILE_ENDPOINT, { title, s3Key })
}

/**
 * 보이스 프로필을 동화에 연결한다 — `PATCH /api/stories/{storyId}/voice-profile`.
 *
 * 보이스 클론 commit 또는 기존 음성 load 직후에 호출해야 한다.
 * 이걸 호출하지 않으면 Step 7 → 8 confirm 단계에서
 * `voice_profile_id IS NULL` 가드(409 INVALID_STORY_STATE)에 걸린다.
 */
export async function attachVoiceProfileToStory(
  storyId: StoryId,
  voiceProfileId: VoiceProfileId,
): Promise<void> {
  await patch<unknown>(`/stories/${storyId}/voice-profile`, { voiceProfileId })
}

/** GET /api/voice-profiles — 내 보이스 프로필 목록 */
export async function getVoiceProfiles(): Promise<VoiceProfileDto[]> {
  return get<VoiceProfileDto[]>(VOICE_PROFILE_ENDPOINT)
}

export interface StoryVoiceAssignmentDto {
  speakerKey: string
  speakerName: string | null
  voiceProfileId: VoiceProfileId
}

export interface StoryVoiceAssignmentItemRequest {
  speakerKey: string
  speakerName?: string | null
  voiceProfileId: VoiceProfileId
}

export async function getStoryVoiceAssignments(
  storyId: StoryId,
): Promise<StoryVoiceAssignmentDto[]> {
  return get<StoryVoiceAssignmentDto[]>(`/stories/${storyId}/voice-assignments`)
}

export async function putStoryVoiceAssignments(
  storyId: StoryId,
  assignments: StoryVoiceAssignmentItemRequest[],
): Promise<StoryVoiceAssignmentDto[]> {
  return put<StoryVoiceAssignmentDto[]>(`/stories/${storyId}/voice-assignments`, { assignments })
}

/** DELETE /api/voice-profiles/{id} */
export async function deleteVoiceProfile(voiceProfileId: VoiceProfileId): Promise<void> {
  return deleteRequest<void>(`${VOICE_PROFILE_ENDPOINT}/${voiceProfileId}`)
}

export interface VoicePreviewJobDto {
  previewId: string
  jobType: string
  status: string
}

/** POST /api/voice-profiles/{id}/preview — TTS 미리듣기 비동기 작업 시작 (202 Accepted) */
export async function postVoicePreview(
  voiceProfileId: VoiceProfileId,
  text: string,
  language: string = 'ko-KR',
): Promise<VoicePreviewJobDto> {
  return post<VoicePreviewJobDto>(`${VOICE_PROFILE_ENDPOINT}/${voiceProfileId}/preview`, {
    text,
    language,
  })
}

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
export async function getVoicePreview(previewId: string): Promise<VoicePreviewStatusDto> {
  return get<VoicePreviewStatusDto>(`${VOICE_PROFILE_ENDPOINT}/previews/${previewId}`)
}

interface RecordingScriptResponse {
  script: string
}

/** GET /api/voice-recording-script?storyId={id} — 아이 이름이 주입된 녹음 스크립트 */
export async function getRecordingScript(storyId?: StoryId | null): Promise<string> {
  const query = storyId ? `?storyId=${storyId}` : ''
  const res = await get<RecordingScriptResponse>(`${VOICE_RECORDING_SCRIPT_ENDPOINT}${query}`)
  return res.script
}
