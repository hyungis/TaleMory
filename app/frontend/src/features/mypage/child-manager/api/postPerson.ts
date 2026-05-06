import { post } from '../../../../shared/api'
import type { Person } from '../../../../entities/person'
import { mapPerson, type CreatePersonRequest, type PersonResponse } from './types'

export async function postPerson(userId: number, body: CreatePersonRequest): Promise<Person> {
  const payload = await post<PersonResponse>('/persons', body)
  return mapPerson(payload, userId)
}
