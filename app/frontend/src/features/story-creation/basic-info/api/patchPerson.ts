import { patch } from '../../../../shared/api'
import type { ModifyPersonRequest, PersonResponse } from './types'

/** PATCH /api/persons/{id} — 전달된 필드만 부분 수정. */
export function patchPerson(id: number, body: ModifyPersonRequest): Promise<PersonResponse> {
  return patch<PersonResponse>(`/persons/${id}`, body)
}
