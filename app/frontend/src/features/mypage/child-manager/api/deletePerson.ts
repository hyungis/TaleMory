import { deleteRequest } from '../../../../shared/api'

export function deletePerson(personId: number): Promise<void> {
  return deleteRequest<void>(`/persons/${personId}`)
}
