import { post } from '../../../../shared/api'

export async function postLogout(): Promise<void> {
  await post<void>('/auth/logout', undefined, {
    skipAuth: true,
    timeoutMs: 10000,
  })
}
