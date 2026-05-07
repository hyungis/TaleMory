import type { JobId } from '../types'
import type { ApiRequestConfig } from './request'

/**
 * 백엔드 공통 성공 응답.
 * `ApiResponse<Unit>`처럼 성공이지만 data가 비어 있는 경우를 허용한다.
 */
export interface ApiSuccess<TData> {
  success: true
  data?: TData | null
  message?: string
}

/** 백엔드 공통 실패 응답. */
export interface ApiFailure {
  success: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure

/**
 * 백엔드 JobStatus enum 문자열과 동일하게 맞춘 타입이다.
 * 프론트에서 임의의 소문자 상태를 만들지 않고 서버 값을 그대로 따른다.
 */
export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'

/** 비동기 생성 작업 시작 시 내려오는 최소 응답 구조다. */
export interface JobStart {
  jobId: JobId
  jobType: string
  status: JobStatus
}

/**
 * 응답 인터셉터가 받는 컨텍스트.
 * 요청/응답 원본과 최종 data를 함께 보면서 후처리할 수 있다.
 */
export interface ApiResponseContext<TData = unknown> {
  request: ApiRequestConfig
  response: Response
  payload: ApiResponse<TData> | null
  data: TData
}

/**
 * payload가 성공 규약인지 판별하는 타입 가드다.
 * 단, data 존재 여부까지 보장하지는 않는다.
 */
export function isApiSuccess<TData>(payload: unknown): payload is ApiSuccess<TData> {
  if (!payload || typeof payload !== 'object') return false

  const candidate = payload as { success?: unknown }
  return candidate.success === true
}

/** payload가 실패 규약인지 판별하는 타입 가드다. */
export function isApiFailure(payload: unknown): payload is ApiFailure {
  if (!payload || typeof payload !== 'object') return false

  const candidate = payload as {
    success?: unknown
    error?: {
      code?: unknown
      message?: unknown
    }
  }

  return (
    candidate.success === false &&
    typeof candidate.error?.code === 'string' &&
    typeof candidate.error?.message === 'string'
  )
}
