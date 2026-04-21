/**
 * 요청 빌더 유틸. 실제 HTTP 호출은 client.ts 에서 수행.
 */

export function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  if (entries.length === 0) return ''
  const encoded = entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  return `?${encoded.join('&')}`
}
