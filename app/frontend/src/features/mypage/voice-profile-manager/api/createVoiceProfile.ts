import { post } from '../../../../shared/api'
import type { VoiceProfile } from '../../../../entities/voice-profile'
import { mapVoiceProfile, type VoiceProfileResponse } from './types'

const VOICE_PROFILES_ENDPOINT = '/voice-profiles'

interface VoicePresignResponse {
  uploadUrl: string
  s3Key: string
  expiresAt: string
}

interface CreateVoiceProfileInput {
  title: string
  audioBlob: Blob
}

export async function createVoiceProfile({
  title,
  audioBlob,
}: CreateVoiceProfileInput): Promise<VoiceProfile> {
  const presigned = await presignVoiceUpload(audioBlob.type || 'audio/webm')
  await uploadAudioToS3(presigned.uploadUrl, audioBlob)

  const payload = await post<VoiceProfileResponse>(VOICE_PROFILES_ENDPOINT, {
    title,
    s3Key: presigned.s3Key,
  })

  return mapVoiceProfile(payload)
}

function presignVoiceUpload(contentType: string): Promise<VoicePresignResponse> {
  return post<VoicePresignResponse>(`${VOICE_PROFILES_ENDPOINT}/presigned-url`, { contentType })
}

async function uploadAudioToS3(uploadUrl: string, audioBlob: Blob): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
    body: audioBlob,
  })

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status}`)
  }
}
