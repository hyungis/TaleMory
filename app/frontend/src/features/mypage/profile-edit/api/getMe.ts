import { get } from '../../../../shared/api'
import type { UserProfile } from '../../../../entities/user'
import { mapUserProfile, type MeResponse } from './types'

export async function getMe(): Promise<UserProfile> {
  const payload = await get<MeResponse>('/me')
  return mapUserProfile(payload)
}
