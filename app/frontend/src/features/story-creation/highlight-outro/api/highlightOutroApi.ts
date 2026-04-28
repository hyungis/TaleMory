import { get, post, put, deleteRequest } from '../../../../shared/api/client'

// ── Types ──

export interface SceneDto {
  id: number
  pageNumber: number
  illustrationUrl: string | null
  sentences: SentenceDto[]
}

export interface SentenceDto {
  id: number
  sentenceOrder: number
  englishText: string
  koreanText: string | null
  ttsAudioUrl: string | null
  speakerKey: string | null
  bubbleSlot: string | null
  hasHighlighted: boolean
}

export interface PresignedUrlDto {
  uploadUrl: string
  s3Key: string
  expiresAt: string
}

export interface HighlightVoiceDto {
  highlightVoiceId: number
  sentenceId: number
  audioUrl: string
}

export interface OutroDto {
  id: number
  outroText: string
  audioUrl: string | null
  signature: string | null
}

// ── Scenes ──

/** GET /api/stories/{storyId}/scenes */
export async function getScenes(storyId: number): Promise<SceneDto[]> {
  return get<SceneDto[]>(`/stories/${storyId}/scenes`)
}

/** GET /api/stories/{storyId}/outro */
export async function getOutro(storyId: number): Promise<OutroDto | null> {
  return get<OutroDto | null>(`/stories/${storyId}/outro`)
}

// ── Highlight Voice (3-phase) ──

/** Phase 1: presigned PUT URL 발급 */
export async function presignHighlightVoice(
  storyId: number,
  sentenceId: number,
  contentType: string = 'audio/webm',
): Promise<PresignedUrlDto> {
  return post<PresignedUrlDto>(
    `/stories/${storyId}/sentences/${sentenceId}/highlight-voice/presigned-url`,
    { contentType },
  )
}

/** Phase 2: S3 직접 업로드 */
export async function uploadAudioToS3(uploadUrl: string, audioBlob: Blob): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
    body: audioBlob,
  })
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`)
}

/** Phase 3: DB commit */
export async function commitHighlightVoice(
  storyId: number,
  sentenceId: number,
  s3Key: string,
): Promise<HighlightVoiceDto> {
  return post<HighlightVoiceDto>(
    `/stories/${storyId}/sentences/${sentenceId}/highlight-voice`,
    { s3Key },
  )
}

/** DELETE 강조 녹음 삭제 */
export async function deleteHighlightVoice(
  storyId: number,
  sentenceId: number,
): Promise<void> {
  return deleteRequest<void>(`/stories/${storyId}/sentences/${sentenceId}/highlight-voice`)
}

// ── Outro ──

/** PUT /api/stories/{storyId}/outro — 마무리 멘트 텍스트 저장 */
export async function saveOutro(
  storyId: number,
  outroText: string,
  signature?: string | null,
): Promise<OutroDto> {
  return put<OutroDto>(`/stories/${storyId}/outro`, { outroText, signature })
}

/** Phase 1: 아웃트로 음성 presigned URL */
export async function presignOutroVoice(
  storyId: number,
  contentType: string = 'audio/webm',
): Promise<PresignedUrlDto> {
  return post<PresignedUrlDto>(
    `/stories/${storyId}/outro/voice/presigned-url`,
    { contentType },
  )
}

/** Phase 3: 아웃트로 음성 DB commit */
export async function commitOutroVoice(
  storyId: number,
  s3Key: string,
): Promise<OutroDto> {
  return post<OutroDto>(`/stories/${storyId}/outro/voice`, { s3Key })
}
