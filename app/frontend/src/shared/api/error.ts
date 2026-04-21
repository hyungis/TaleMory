/**
 * 공통 API 에러 타입. 서버 응답 규약: { success: false, error: { code, message } }
 * 파싱 이후 상위 레이어에서 이 에러로 throw.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
