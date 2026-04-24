import { useQuery } from '@tanstack/react-query'
import { getPersons } from '../api/getPersons'
import type { PersonResponse, PersonRoleApi } from '../api/types'

/**
 * 저장된 인물 목록 조회 훅.
 *
 * - queryKey: `['persons', { role }]` — role 별 캐시 분리
 * - `role` 없으면 전체 목록, 'CHILD' / 'COMPANION' 으로 필터링 가능
 * - BasicInfoStep 의 "저장된 아이 불러오기" 드롭다운에서 `role='CHILD'` 로 사용
 */
export function usePersonsQuery(role?: PersonRoleApi) {
  return useQuery<PersonResponse[]>({
    queryKey: ['persons', { role: role ?? null }],
    queryFn: () => getPersons(role),
  })
}
