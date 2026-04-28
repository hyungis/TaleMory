import { ApiError, normalizeApiError, post } from '../../../../shared/api'
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
  let response: Response

  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
      body: audioBlob,
    })
  } catch (error) {
    throw normalizeApiError(error, {
      code: 'S3_UPLOAD_NETWORK_ERROR',
      method: 'PUT',
      url: 's3-presigned-upload',
      message: '음성 파일 업로드 연결에 실패했습니다. 네트워크 또는 S3 CORS 설정을 확인해 주세요.',
    })
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: response.status === 403 ? 'S3_UPLOAD_FORBIDDEN' : 'S3_UPLOAD_FAILED',
      method: 'PUT',
      url: 's3-presigned-upload',
      response,
      message: getS3UploadErrorMessage(response.status),
    })
  }
}

function getS3UploadErrorMessage(status: number): string {
  if (status === 400) {
    return '음성 업로드 요청 형식이 올바르지 않습니다. 녹음을 다시 시도해 주세요.'
  }

  if (status === 403) {
    return '음성 업로드 권한이 만료되었거나 S3 설정이 올바르지 않습니다. 다시 저장해 주세요.'
  }

  if (status === 413) {
    return '음성 파일이 너무 큽니다. 더 짧게 녹음한 뒤 다시 저장해 주세요.'
  }

  if (status >= 500) {
    return 'S3 저장소 응답이 불안정합니다. 잠시 후 다시 시도해 주세요.'
  }

  return '음성 파일 업로드에 실패했습니다. 다시 시도해 주세요.'
}
