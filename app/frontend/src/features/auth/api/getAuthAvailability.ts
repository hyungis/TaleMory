import { get } from '../../../shared/api'

export interface AuthAvailabilityResponse {
  available: boolean
}

export function getLoginIdAvailability(loginId: string): Promise<AuthAvailabilityResponse> {
  return get<AuthAvailabilityResponse>('/auth/login-id/check', {
    query: { loginId },
    skipAuth: true,
    timeoutMs: 5000,
  })
}

export function getNicknameAvailability(nickname: string): Promise<AuthAvailabilityResponse> {
  return get<AuthAvailabilityResponse>('/auth/nickname/check', {
    query: { nickname },
    skipAuth: true,
    timeoutMs: 5000,
  })
}
