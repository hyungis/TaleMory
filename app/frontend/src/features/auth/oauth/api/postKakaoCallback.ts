import { post } from '../../../../shared/api'
import type { KakaoCallbackRequest, KakaoCallbackResponsePayload } from '../types'

export async function postKakaoCallback(body: KakaoCallbackRequest): Promise<KakaoCallbackResponsePayload> {
  return post<KakaoCallbackResponsePayload>(
    '/auth/kakao/callback',
    {
      code: body.code,
      redirectUri: body.redirectUri,
    },
    {
      skipAuth: true,
      timeoutMs: 10000,
    },
  )
}
