import type { LoginResponsePayload } from '../../login'

export interface OauthCallbackPayloadResult {
  payload: LoginResponsePayload | null
  error: string | null
}

export function parseOauthCallbackPayload(hash: string, search: string): OauthCallbackPayloadResult {
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  const rawError = hashParams.get('error') ?? searchParams.get('error')
  if (rawError) {
    return {
      payload: null,
      error: decodeParameter(rawError),
    }
  }

  const encodedPayload = hashParams.get('payload') ?? searchParams.get('payload')
  if (!encodedPayload) {
    return {
      payload: null,
      error: '카카오 로그인 결과를 확인할 수 없어요. 다시 시도해주세요.',
    }
  }

  try {
    return {
      payload: JSON.parse(decodeParameter(encodedPayload)) as LoginResponsePayload,
      error: null,
    }
  } catch {
    return {
      payload: null,
      error: '카카오 로그인 응답을 처리하지 못했어요. 다시 시도해주세요.',
    }
  }
}

function decodeParameter(value: string): string {
  return decodeURIComponent(value)
}
