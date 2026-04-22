/**
 * 공통 API 에러 타입. 서버 응답 규약: { success: false, error: { code, message } }
 * 파싱 이후 상위 레이어에서 이 에러로 throw.
 *
 * TS 6 `erasableSyntaxOnly` 모드에서는 constructor parameter property 문법이 금지되므로
 * 필드는 명시적으로 선언한 뒤 constructor 에서 할당한다.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}
