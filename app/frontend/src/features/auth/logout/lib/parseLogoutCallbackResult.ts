export interface LogoutCallbackResult {
  provider: string | null
  error: string | null
}

export function parseLogoutCallbackResult(hash: string, search: string): LogoutCallbackResult {
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  const rawError = hashParams.get('error') ?? searchParams.get('error')
  const provider = hashParams.get('provider') ?? searchParams.get('provider')

  return {
    provider,
    error: rawError ? decodeURIComponent(rawError) : null,
  }
}
