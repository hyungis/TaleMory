/**
 * FE 컨벤션의 공통 응답 스키마.
 * - 성공: { success: true, data, message? }
 * - 실패: { success: false, error: { code, message } }
 * - 비동기 시작: { jobId, jobType, status }
 */

export interface ApiSuccess<TData> {
  success: true
  data: TData
  message?: string
}

export interface ApiFailure {
  success: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure

export type JobStatus = 'idle' | 'pending' | 'running' | 'success' | 'failed'

export interface JobStart {
  jobId: string
  jobType: string
  status: JobStatus
}
