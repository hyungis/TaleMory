import { patch } from '../../../../shared/api'
import type { ModifyPersonRequest, PersonResponse } from './types'
import type { PersonId } from '../../../../shared/types'

/** PATCH /api/persons/{id} — 전달된 필드만 부분 수정. */
export function patchPerson(id: PersonId, body: ModifyPersonRequest): Promise<PersonResponse> {
  return patch<PersonResponse>(`/persons/${id}`, body)
}
