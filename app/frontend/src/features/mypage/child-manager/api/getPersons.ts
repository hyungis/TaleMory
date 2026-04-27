import { get } from '../../../../shared/api'
import type { Person } from '../../../../entities/person'
import { mapPerson, type PersonResponse } from './types'

export async function getPersons(userId: number): Promise<Person[]> {
  const payload = await get<PersonResponse[]>('/persons')
  return payload.map((person) => mapPerson(person, userId))
}
