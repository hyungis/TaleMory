import { post } from '../../../../shared/api'
import type { CreatePersonRequest, PersonResponse } from './types'

/** POST /api/persons — 인물 신규 등록. 201 CREATED + 저장된 Person 반환. */
export function postPerson(body: CreatePersonRequest): Promise<PersonResponse> {
  return post<PersonResponse>('/persons', body)
}
