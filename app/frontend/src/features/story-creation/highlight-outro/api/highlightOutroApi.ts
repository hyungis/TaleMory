import { get, post, put, deleteRequest } from '../../../../shared/api/client'
import type { SceneId, SentenceId, StoryId } from '../../../../shared/types'

// ── Types ──

export interface SceneDto {
  id: SceneId
  pageNumber: number
  illustrationUrl: string | null
  sentences: SentenceDto[]
}

export interface SentenceDto {
  id: SentenceId
  sentenceOrder: number
  englishText: string
  koreanText: string | null
  ttsAudioUrl: string | null
  speakerKey: string | null
  bubbleSlot: string | null
  hasHighlighted: boolean
  /**
   * 사용자가 녹음한 강조 audio URL. 활성 row 가 없으면 null.
   * Step 7 재진입 시 기존 녹음 복원에 사용.
   */
  highlightVoiceUrl: string | null
}

export interface PresignedUrlDto {
  uploadUrl: string
  s3Key: string
  expiresAt: string
}

export interface HighlightVoiceDto {
  highlightVoiceId: number
  sentenceId: SentenceId
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
export async function getScenes(storyId: StoryId): Promise<SceneDto[]> {
  return get<SceneDto[]>(`/stories/${storyId}/scenes`)
}

export interface ScenesPrepareDto {
  sceneCount: number
  sentenceCount: number
  alreadyPrepared: boolean
}

/**
 * POST /api/stories/{storyId}/scenes/prepare
 *
 * Step 7 진입 시점에 `storyboard_pages.sentences` JSON 으로부터 scene/scene_sentence 를
 * 평탄화 INSERT (멱등). 이후 getScenes 로 정규화된 데이터 조회.
 */
export async function prepareScenes(storyId: StoryId): Promise<ScenesPrepareDto> {
  return post<ScenesPrepareDto>(`/stories/${storyId}/scenes/prepare`, {})
}

export interface HighlightVoicesExistsDto {
  exists: boolean
}

/**
 * GET /api/stories/{storyId}/highlight-voices/exists
 *
 * Step 4 본문 재생성 경고 모달 트리거용 — 활성 강조 녹음이 하나라도 있으면 true.
 */
export async function checkHighlightVoicesExists(
  storyId: StoryId,
): Promise<HighlightVoicesExistsDto> {
  return get<HighlightVoicesExistsDto>(`/stories/${storyId}/highlight-voices/exists`)
}

/** GET /api/stories/{storyId}/outro */
export async function getOutro(storyId: StoryId): Promise<OutroDto | null> {
  return get<OutroDto | null>(`/stories/${storyId}/outro`)
}

// ── Highlight Voice (3-phase) ──

/** Phase 1: presigned PUT URL 발급 */
export async function presignHighlightVoice(
  storyId: StoryId,
  sentenceId: SentenceId,
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
  storyId: StoryId,
  sentenceId: SentenceId,
  s3Key: string,
): Promise<HighlightVoiceDto> {
  return post<HighlightVoiceDto>(
    `/stories/${storyId}/sentences/${sentenceId}/highlight-voice`,
    { s3Key },
  )
}

/** DELETE 강조 녹음 삭제 */
export async function deleteHighlightVoice(
  storyId: StoryId,
  sentenceId: SentenceId,
): Promise<void> {
  return deleteRequest<void>(`/stories/${storyId}/sentences/${sentenceId}/highlight-voice`)
}

// ── Outro ──

/** PUT /api/stories/{storyId}/outro — 마무리 멘트 텍스트 저장 */
export async function saveOutro(
  storyId: StoryId,
  outroText: string,
  signature?: string | null,
): Promise<OutroDto> {
  return put<OutroDto>(`/stories/${storyId}/outro`, { outroText, signature })
}

/** Phase 1: 아웃트로 음성 presigned URL */
export async function presignOutroVoice(
  storyId: StoryId,
  contentType: string = 'audio/webm',
): Promise<PresignedUrlDto> {
  return post<PresignedUrlDto>(
    `/stories/${storyId}/outro/voice/presigned-url`,
    { contentType },
  )
}

/** Phase 3: 아웃트로 음성 DB commit */
export async function commitOutroVoice(
  storyId: StoryId,
  s3Key: string,
): Promise<OutroDto> {
  return post<OutroDto>(`/stories/${storyId}/outro/voice`, { s3Key })
}
