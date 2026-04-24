import { ApiError, normalizeApiError } from './error'
import { ErrorInterceptorManager, InterceptorManager } from './interceptor'
import { createApiRequestConfig, type ApiClientOptions, type ApiRequestConfig } from './request'
import { isApiFailure, isApiSuccess, type ApiResponse, type ApiResponseContext } from './response'

/**
 * 프론트가 실제 네트워크 호출에 사용할 공용 base URL이다.
 * 환경변수가 없으면 nginx 프록시 기준 `/api`를 사용한다.
 */
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

/**
 * 토큰 저장 위치를 shared/api가 직접 알지 않도록,
 * "토큰을 꺼내오는 함수"만 외부에서 주입받기 위한 타입이다.
 */
export type AccessTokenResolver = () => string | null | undefined | Promise<string | null | undefined>
export type UnauthorizedRetryHandler = (error: ApiError) => boolean | Promise<boolean>

let accessTokenResolver: AccessTokenResolver | null = null
let unauthorizedRetryHandler: UnauthorizedRetryHandler | null = null

/** request / response / error 각 단계의 공통 후처리 확장 포인트다. */
export const apiRequestInterceptors = new InterceptorManager<ApiRequestConfig>()
export const apiResponseInterceptors = new InterceptorManager<ApiResponseContext<unknown>>()
export const apiErrorInterceptors = new ErrorInterceptorManager<ApiError>()

/**
 * 기본 인증 인터셉터.
 * skipAuth가 아니고 직접 Authorization을 넣지 않은 경우에만 Bearer 토큰을 자동 주입한다.
 */
apiRequestInterceptors.use(async request => {
  if (request.skipAuth) return request
  if (request.headers.has('Authorization')) return request
  if (accessTokenResolver === null) return request

  const token = await accessTokenResolver()
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`)
  }

  return request
})

/** 앱 전역에서 사용할 access token 조회 함수를 등록한다. */
export function setAccessTokenResolver(resolver: AccessTokenResolver | null): void {
  accessTokenResolver = resolver
}

export function setUnauthorizedRetryHandler(handler: UnauthorizedRetryHandler | null): void {
  unauthorizedRetryHandler = handler
}

/** 로그아웃 등으로 토큰 주입 로직을 비활성화할 때 사용한다. */
export function clearAccessTokenResolver(): void {
  accessTokenResolver = null
}

export function clearUnauthorizedRetryHandler(): void {
  unauthorizedRetryHandler = null
}

/**
 * 공용 HTTP 진입점.
 * 요청 정규화 -> 요청 인터셉터 -> fetch -> 응답 파싱 -> 에러 정규화 순서로 동작한다.
 */
export async function apiClient<TData>(path: string, options: ApiClientOptions = {}): Promise<TData> {
  return executeApiClient<TData>(path, options, false)
}

async function executeApiClient<TData>(
  path: string,
  options: ApiClientOptions,
  hasRetriedAfterUnauthorized: boolean,
): Promise<TData> {
  const initialRequest = createApiRequestConfig(path, API_BASE_URL, options)
  const request = await apiRequestInterceptors.run(initialRequest)
  const abortSupport = createAbortSupport(request.signal ?? undefined, request.timeoutMs)

  try {
    const response = await fetch(request.url, createFetchInit(request, abortSupport.signal))
    const payload = (await parseResponseBody(response)) as ApiResponse<TData> | unknown

    if (!response.ok || isApiFailure(payload)) {
      throw createHttpError(request, response, payload)
    }

    const responseContext = await runResponseInterceptors<TData>({
      request,
      response,
      payload: isApiSuccess<TData>(payload) ? payload : null,
      data: extractResponseData<TData>(payload),
    })

    return responseContext.data
  } catch (error) {
    const normalizedError = normalizeRequestError(error, request, abortSupport.signal)

    if (shouldRetryAfterUnauthorized(request, normalizedError, hasRetriedAfterUnauthorized)) {
      const recovered = await unauthorizedRetryHandler?.(normalizedError)
      if (recovered === true) {
        return executeApiClient<TData>(path, options, true)
      }
    }

    return throwInterceptedError(normalizedError)
  } finally {
    abortSupport.cleanup()
  }
}

/** method만 다르고 실제 구현은 모두 apiClient를 재사용하는 편의 함수들이다. */
export function get<TData>(
  path: string,
  options: Omit<ApiClientOptions, 'method' | 'body'> = {},
): Promise<TData> {
  return apiClient<TData>(path, {
    ...options,
    method: 'GET',
  })
}

export function post<TData>(
  path: string,
  body?: ApiClientOptions['body'],
  options: Omit<ApiClientOptions, 'method' | 'body'> = {},
): Promise<TData> {
  return apiClient<TData>(path, {
    ...options,
    method: 'POST',
    body,
  })
}

export function put<TData>(
  path: string,
  body?: ApiClientOptions['body'],
  options: Omit<ApiClientOptions, 'method' | 'body'> = {},
): Promise<TData> {
  return apiClient<TData>(path, {
    ...options,
    method: 'PUT',
    body,
  })
}

export function patch<TData>(
  path: string,
  body?: ApiClientOptions['body'],
  options: Omit<ApiClientOptions, 'method' | 'body'> = {},
): Promise<TData> {
  return apiClient<TData>(path, {
    ...options,
    method: 'PATCH',
    body,
  })
}

export function deleteRequest<TData>(
  path: string,
  options: Omit<ApiClientOptions, 'method' | 'body'> = {},
): Promise<TData> {
  return apiClient<TData>(path, {
    ...options,
    method: 'DELETE',
  })
}

export const http = {
  request: apiClient,
  get,
  post,
  put,
  patch,
  delete: deleteRequest,
}

/** 성공 응답 컨텍스트를 응답 인터셉터 체인에 넘긴다. */
async function runResponseInterceptors<TData>(
  context: ApiResponseContext<TData>,
): Promise<ApiResponseContext<TData>> {
  const nextContext = await apiResponseInterceptors.run(context as ApiResponseContext<unknown>)
  return nextContext as ApiResponseContext<TData>
}

/**
 * 에러 인터셉터를 모두 실행한 뒤 최종 에러를 다시 throw 한다.
 * `Promise<never>`는 이 함수가 정상 값을 반환하지 않는다는 뜻이다.
 */
async function throwInterceptedError(error: ApiError): Promise<never> {
  const interceptedError = await apiErrorInterceptors.run(error)
  throw interceptedError
}

/**
 * 내부 요청 객체에서 fetch가 이해할 수 있는 RequestInit만 추려낸다.
 * url/path/meta 같은 내부 문맥 값은 여기서 제외한다.
 */
function createFetchInit(request: ApiRequestConfig, signal: AbortSignal | undefined): RequestInit {
  const {
    url,
    path,
    baseUrl,
    query,
    skipAuth,
    timeoutMs,
    meta,
    headers,
    body,
    method = 'GET',
    ...rest
  } = request

  void url
  void path
  void baseUrl
  void query
  void skipAuth
  void timeoutMs
  void meta

  const requestInit: RequestInit = {
    ...rest,
    method,
    headers,
    credentials: request.credentials ?? 'include',
    signal,
  }

  if (body !== undefined && methodAllowsBody(method)) {
    requestInit.body = body
  }

  return requestInit
}

function methodAllowsBody(method: string): boolean {
  const normalizedMethod = method.toUpperCase()
  return normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD'
}

function shouldRetryAfterUnauthorized(
  request: ApiRequestConfig,
  error: ApiError,
  hasRetriedAfterUnauthorized: boolean,
): boolean {
  if (hasRetriedAfterUnauthorized) return false
  if (unauthorizedRetryHandler === null) return false
  if (error.status !== 401) return false
  if (request.skipAuth) return false

  return request.meta.isAuthRefreshRequest !== true
}

/**
 * 외부 abort signal과 timeout abort를 하나의 AbortController로 묶는다.
 * 요청이 끝나면 리스너와 타이머를 반드시 cleanup 한다.
 */
function createAbortSupport(signal?: AbortSignal, timeoutMs?: number): {
  signal: AbortSignal | undefined
  cleanup: () => void
} {
  if (signal === undefined && timeoutMs === undefined) {
    return {
      signal: undefined,
      cleanup: () => {},
    }
  }

  const controller = new AbortController()
  let timeoutId: number | undefined
  let abortListener: (() => void) | undefined

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason)
    } else {
      abortListener = () => controller.abort(signal.reason)
      signal.addEventListener('abort', abortListener, { once: true })
    }
  }

  if (timeoutMs !== undefined) {
    timeoutId = setTimeout(() => {
      controller.abort(new DOMException('Request timed out.', 'TimeoutError'))
    }, timeoutMs)
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      if (signal && abortListener) {
        signal.removeEventListener('abort', abortListener)
      }
    },
  }
}

/**
 * Content-Type에 따라 응답 본문을 JSON / text / blob으로 분기 파싱한다.
 * 204/205처럼 본문이 없는 성공 응답은 undefined로 처리한다.
 */
async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined

  const contentType = response.headers.get('Content-Type') ?? ''

  if (contentType.includes('application/json')) {
    const rawText = await response.text()
    if (!rawText) return undefined

    try {
      return JSON.parse(rawText) as unknown
    } catch {
      return rawText
    }
  }

  if (contentType.startsWith('text/')) {
    return response.text()
  }

  return response.blob()
}

/**
 * 공통 성공 응답이면 `data`만 꺼내고,
 * data가 비어 있으면 Unit 응답을 다루기 쉽게 undefined로 맞춘다.
 */
function extractResponseData<TData>(payload: ApiResponse<TData> | unknown): TData {
  if (isApiSuccess<TData>(payload)) {
    return (payload.data ?? undefined) as TData
  }

  return payload as TData
}

/** 실패 응답 payload를 풍부한 ApiError 객체로 변환한다. */
function createHttpError(request: ApiRequestConfig, response: Response, payload: unknown): ApiError {
  const extractedMessage = extractErrorMessage(payload)
  const extractedCode = extractErrorCode(payload)

  return new ApiError({
    status: response.status,
    message: extractedMessage ?? `Request failed with status ${response.status}.`,
    code: extractedCode,
    payload,
    method: request.method ?? 'GET',
    url: request.url,
    response,
  })
}

/**
 * fetch 단계에서 터진 예외를 ApiError로 정규화한다.
 * timeout과 일반 네트워크 실패를 구분해서 코드화한다.
 */
function normalizeRequestError(
  error: unknown,
  request: ApiRequestConfig,
  signal: AbortSignal | undefined,
): ApiError {
  if (error instanceof ApiError) return error

  const signalReason = signal?.aborted ? signal.reason : undefined
  if (signalReason instanceof DOMException && signalReason.name === 'TimeoutError') {
    return new ApiError({
      message: `Request timed out after ${request.timeoutMs}ms.`,
      status: 0,
      code: 'REQUEST_TIMEOUT',
      method: request.method ?? 'GET',
      url: request.url,
      cause: error,
    })
  }

  return normalizeApiError(error, {
    status: 0,
    code: 'NETWORK_ERROR',
    message: 'Network request failed.',
    method: request.method ?? 'GET',
    url: request.url,
  })
}

/** payload에서 사용자에게 보여줄 메시지를 최대한 유연하게 추출한다. */
function extractErrorMessage(payload: unknown): string | undefined {
  if (isApiFailure(payload)) {
    return payload.error.message
  }

  if (!payload || typeof payload !== 'object') return undefined

  const candidate = payload as {
    message?: unknown
    error?: {
      message?: unknown
    }
  }

  if (typeof candidate.message === 'string') return candidate.message
  if (typeof candidate.error?.message === 'string') return candidate.error.message

  return undefined
}

/** payload에서 서버/비즈니스 에러 코드를 최대한 유연하게 추출한다. */
function extractErrorCode(payload: unknown): string | undefined {
  if (isApiFailure(payload)) {
    return payload.error.code
  }

  if (!payload || typeof payload !== 'object') return undefined

  const candidate = payload as {
    code?: unknown
    error?: {
      code?: unknown
    }
  }

  if (typeof candidate.code === 'string') return candidate.code
  if (typeof candidate.error?.code === 'string') return candidate.error.code

  return undefined
}
