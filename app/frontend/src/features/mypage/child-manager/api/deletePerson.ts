import { deleteRequest } from '../../../../shared/api'
import type { PersonId } from '../../../../shared/types'

export function deletePerson(personId: PersonId): Promise<void> {
  return deleteRequest<void>(`/persons/${personId}`)
}
