import { patch } from '../../../../shared/api'
import type { UserProfile } from '../../../../entities/user'
import { mapUserProfile, type MeResponse, type UpdateMeRequest } from './types'

export async function patchMe(body: UpdateMeRequest): Promise<UserProfile> {
  const payload = await patch<MeResponse>('/me', body)
  return mapUserProfile(payload)
}
