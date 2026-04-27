import { patch } from '../../../../shared/api'
import type { Person } from '../../../../entities/person'
import { mapPerson, type PersonResponse, type UpdatePersonRequest } from './types'

export async function patchPerson(
  userId: number,
  personId: number,
  body: UpdatePersonRequest,
): Promise<Person> {
  const payload = await patch<PersonResponse>(`/persons/${personId}`, body)
  return mapPerson(payload, userId)
}
