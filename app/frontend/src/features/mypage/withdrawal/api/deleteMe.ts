import { deleteRequest } from '../../../../shared/api'

export function deleteMe(): Promise<void> {
  return deleteRequest<void>('/me')
}
