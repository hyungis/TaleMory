import { get } from '../../../../shared/api'
import type { PersonResponse, PersonRoleApi } from './types'

/**
 * 로그인 유저의 인물 목록 조회.
 * `role` 필터 미지정 시 모든 인물(아이+동행자) 반환.
 */
export function getPersons(role?: PersonRoleApi): Promise<PersonResponse[]> {
  return get<PersonResponse[]>('/persons', {
    query: role ? { role } : undefined,
  })
}
