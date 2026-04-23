/**
 * 외부에서 받은 요청 옵션을 내부 표준 요청 객체로 정규화하는 유틸 모음이다.
 * query string 생성, JSON body 직렬화, 기본 헤더 보정, 최종 URL 생성이 여기서 이뤄진다.
 */
export type QueryParamValue = string | number | boolean | null | undefined
export type QueryParamInput = QueryParamValue | QueryParamValue[]
export type QueryParams = Record<string, QueryParamInput>

export interface ApiClientOptions extends Omit<RequestInit, 'body' | 'headers'> {
  /**
   * plain object/array는 JSON으로 직렬화하고, FormData 등은 그대로 전달한다.
   *
   * NOTE: `Record<string, unknown>` 로 좁히면 interface 로 선언한 DTO가 암묵적 index
   *       signature 부재로 assignable 하지 않아 TS2345 를 낸다 (`tsc -b` 빌드 체크에서
   *       잡힘). `object` 로 넓히되 실제 JSON 직렬화 대상 판별은 `isJsonBody` 런타임
   *       검사에 맡긴다.
   */
  body?: BodyInit | object | null
  headers?: HeadersInit
  /** `{ page: 1, tags: ['a', 'b'] }` 형태를 query string으로 변환할 때 사용한다. */
  query?: QueryParams
  /** 인증이 필요 없는 요청이면 기본 Authorization 주입을 건너뛴다. */
  skipAuth?: boolean
  /** 일정 시간 안에 끝나지 않으면 요청을 abort 하기 위한 timeout 값이다. */
  timeoutMs?: number
  /** 추후 로깅/추적용 메타데이터를 실을 수 있는 확장 포인트다. */
  meta?: Record<string, unknown>
}

/**
 * 내부에서만 사용하는 표준 요청 객체다.
 * fetch에는 필요 없는 path/baseUrl/meta 같은 문맥 정보도 함께 들고 다닌다.
 */
export interface ApiRequestConfig extends Omit<RequestInit, 'body' | 'headers'> {
  url: string
  path: string
  baseUrl: string
  headers: Headers
  body?: BodyInit | null
  query?: QueryParams
  skipAuth: boolean
  timeoutMs?: number
  meta: Record<string, unknown>
}

/**
 * query object를 실제 URL query string으로 바꾼다.
 * 배열 값은 동일 key를 반복하는 방식으로 직렬화한다.
 */
export function buildQueryString(params: QueryParams = {}): string {
  const encodedEntries: string[] = []

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue
        encodedEntries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
      }
      continue
    }

    if (value === undefined || value === null) continue
    encodedEntries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }

  if (encodedEntries.length === 0) return ''
  return `?${encodedEntries.join('&')}`
}

/**
 * base URL, path, query를 합쳐 실제 요청 URL을 만든다.
 * path가 절대 URL이면 baseUrl 대신 그대로 사용한다.
 */
export function buildRequestUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const target = isAbsoluteUrl(path) ? path : joinUrl(baseUrl, path)
  const queryString = buildQueryString(query)

  if (!queryString) return target
  if (target.includes('?')) return `${target}&${queryString.slice(1)}`
  return `${target}${queryString}`
}

/**
 * 헤더 입력을 `Headers` 객체로 통일하고 기본 Accept 헤더를 보장한다.
 */
export function createRequestHeaders(headers?: HeadersInit): Headers {
  const requestHeaders = new Headers(headers)

  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json')
  }

  return requestHeaders
}

/**
 * body 타입에 따라 JSON 직렬화 여부를 결정한다.
 * FormData처럼 브라우저가 직접 처리해야 하는 타입은 그대로 둔다.
 */
export function normalizeRequestBody(
  body: ApiClientOptions['body'],
  headers: Headers,
): BodyInit | null | undefined {
  if (body === undefined || body === null) return body

  if (isJsonBody(body)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    return JSON.stringify(body)
  }

  // isJsonBody 가 false → 런타임상 BodyInit (FormData / Blob / URLSearchParams / ArrayBuffer / ReadableStream) 임이 보장됨.
  // body 타입을 `object` 로 넓힌 이후로는 TS 가 이 분기에서 BodyInit 까지 자동으로 좁혀주지 않아 cast 로 마무리.
  return body as BodyInit
}

/**
 * 외부 옵션을 내부 표준 요청 객체로 한 번에 정리한다.
 * 이후 client.ts는 이 구조만 믿고 동작하므로, 요청 준비 단계의 중심 함수다.
 */
export function createApiRequestConfig(
  path: string,
  baseUrl: string,
  options: ApiClientOptions = {},
): ApiRequestConfig {
  const {
    body,
    headers,
    query,
    skipAuth = false,
    timeoutMs,
    meta = {},
    method = 'GET',
    ...rest
  } = options

  const requestHeaders = createRequestHeaders(headers)

  return {
    ...rest,
    method,
    path,
    url: buildRequestUrl(baseUrl, path, query),
    baseUrl,
    headers: requestHeaders,
    body: normalizeRequestBody(body, requestHeaders),
    query,
    skipAuth,
    timeoutMs,
    meta,
  }
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//.test(value)
}

/**
 * `/api` + `/stories`처럼 base URL과 path를 안전하게 이어붙인다.
 */
function joinUrl(baseUrl: string, path: string): string {
  if (!path) return baseUrl

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${normalizedBaseUrl}${normalizedPath}`
}

/**
 * plain object/array만 JSON body로 취급한다.
 * multipart/binary 계열은 브라우저 기본 처리에 맡겨야 하므로 제외한다.
 */
function isJsonBody(value: NonNullable<ApiClientOptions['body']>): value is Record<string, unknown> | unknown[] {
  if (Array.isArray(value)) return true
  if (typeof value !== 'object') return false

  if (value instanceof FormData) return false
  if (value instanceof URLSearchParams) return false
  if (value instanceof Blob) return false
  if (value instanceof ArrayBuffer) return false
  if (ArrayBuffer.isView(value)) return false
  if (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) return false

  return true
}
