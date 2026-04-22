/**
 * ApiError 생성에 필요한 문맥 정보다.
 * 단순 메시지뿐 아니라 어떤 요청에서 실패했는지도 함께 보존한다.
 */
export interface ApiErrorOptions {
  message: string
  status?: number
  code?: string
  payload?: unknown
  method?: string
  url?: string
  response?: Response
  cause?: unknown
}

/**
 * 공통 API 에러 객체.
 * 서버 비즈니스 실패, HTTP 실패, 네트워크 실패를 하나의 타입으로 통일한다.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly payload?: unknown
  readonly method?: string
  readonly url?: string
  readonly response?: Response
  override readonly cause?: unknown
  readonly isNetworkError: boolean
  readonly isTimeout: boolean

  constructor(options: ApiErrorOptions) {
    super(options.message)
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.code = options.code
    this.payload = options.payload
    this.method = options.method
    this.url = options.url
    this.response = options.response
    this.cause = options.cause
    this.isNetworkError = this.status === 0
    this.isTimeout = this.code === 'REQUEST_TIMEOUT'
  }
}

/** 이미 정규화된 ApiError인지 검사하는 타입 가드다. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * 다양한 종류의 예외를 ApiError 하나로 정규화한다.
 * 호출부는 unknown 에러를 직접 분기하지 않고 ApiError만 처리하면 된다.
 */
export function normalizeApiError(
  error: unknown,
  fallback: Omit<ApiErrorOptions, 'message'> & { message?: string } = {},
): ApiError {
  if (error instanceof ApiError) return error

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError({
      message: fallback.message ?? 'Request was aborted.',
      status: fallback.status,
      code: fallback.code ?? 'REQUEST_ABORTED',
      payload: fallback.payload,
      method: fallback.method,
      url: fallback.url,
      response: fallback.response,
      cause: error,
    })
  }

  if (error instanceof Error) {
    return new ApiError({
      message: fallback.message ?? error.message ?? 'Network request failed.',
      status: fallback.status,
      code: fallback.code ?? 'NETWORK_ERROR',
      payload: fallback.payload,
      method: fallback.method,
      url: fallback.url,
      response: fallback.response,
      cause: error,
    })
  }

  return new ApiError({
    message: fallback.message ?? 'Unexpected request error.',
    status: fallback.status,
    code: fallback.code ?? 'UNKNOWN_ERROR',
    payload: fallback.payload,
    method: fallback.method,
    url: fallback.url,
    response: fallback.response,
    cause: error,
  })
}
