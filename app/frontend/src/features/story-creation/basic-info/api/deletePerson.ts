import { deleteRequest } from '../../../../shared/api'
import type { PersonId } from '../../../../shared/types'

/** DELETE /api/persons/{id} — soft delete. BE 는 200 + `{ success: true }` 를 반환. */
export function deletePerson(id: PersonId): Promise<void> {
  return deleteRequest<void>(`/persons/${id}`)
}
