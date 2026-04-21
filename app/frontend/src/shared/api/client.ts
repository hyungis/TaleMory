import { ApiError } from './error'
import type { ApiResponse } from './response'

/**
 * 공용 fetch wrapper.
 * - base URL: VITE_API_BASE_URL (기본 "/api") — 프론트는 nginx 경유해서 백엔드 호출
 * - JSON 직렬화/역직렬화
 * - 실패 응답은 ApiError 로 throw
 *
 * 인증 헤더 주입, refresh 토큰 로테이션 등은 추후 인터셉터 레이어에서 추가 예정.
 */

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

export interface ApiClientOptions extends RequestInit {
  /** 향후 인증 레이어에서 사용. 현재는 no-op. */
  skipAuth?: boolean
}

export async function apiClient<TData>(path: string, options: ApiClientOptions = {}): Promise<TData> {
  const { skipAuth: _skipAuth, headers, ...rest } = options

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
  })

  let payload: ApiResponse<TData> | null = null
  try {
    payload = (await response.json()) as ApiResponse<TData>
  } catch {
    // 본문이 JSON 이 아닐 수 있음 (204 No Content 등)
  }

  if (!response.ok || (payload && payload.success === false)) {
    const errorCode = payload && payload.success === false ? payload.error.code : undefined
    const errorMessage =
      payload && payload.success === false ? payload.error.message : `Request failed: ${response.statusText}`
    throw new ApiError(response.status, errorMessage, errorCode)
  }

  if (payload && payload.success === true) {
    return payload.data
  }

  // data 없이 성공한 경우 (예: 204) — 호출측이 void 기대
  return undefined as TData
}
