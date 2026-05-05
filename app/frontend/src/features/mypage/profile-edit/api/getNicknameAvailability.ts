import { get } from '../../../../shared/api'

export interface NicknameAvailabilityResponse {
  available: boolean
}

export function getNicknameAvailability(nickname: string): Promise<NicknameAvailabilityResponse> {
  return get<NicknameAvailabilityResponse>('/auth/nickname/check', {
    query: { nickname },
    skipAuth: true,
    timeoutMs: 5000,
  })
}
