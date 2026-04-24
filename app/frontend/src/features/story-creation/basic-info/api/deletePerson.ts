import { deleteRequest } from '../../../../shared/api'

/** DELETE /api/persons/{id} — soft delete. BE 는 200 + `{ success: true }` 를 반환. */
export function deletePerson(id: number): Promise<void> {
  return deleteRequest<void>(`/persons/${id}`)
}
