import type { Person } from '../../../../entities/person'
import type { PersonId } from '../../../../shared/types'

export type PersonGenderApi = 'MALE' | 'FEMALE' | 'OTHER'
export type PersonRoleApi = 'CHILD' | 'COMPANION'

export interface PersonResponse {
  id: PersonId
  name: string
  age: number
  gender: PersonGenderApi
  role: PersonRoleApi
}

export interface CreatePersonRequest {
  name: string
  age: number
  gender: PersonGenderApi
  role: PersonRoleApi
}

export interface UpdatePersonRequest {
  name?: string
  age?: number
  gender?: PersonGenderApi
}

export function mapPerson(payload: PersonResponse, userId: number): Person {
  return {
    id: payload.id,
    userId,
    name: payload.name,
    age: payload.age,
    gender: mapGender(payload.gender),
    role: mapRole(payload.role),
  }
}

function mapGender(gender: PersonGenderApi): Person['gender'] {
  switch (gender) {
    case 'MALE':
      return 'male'
    case 'FEMALE':
      return 'female'
    default:
      return 'other'
  }
}

function mapRole(role: PersonRoleApi): Person['role'] {
  return role === 'COMPANION' ? 'companion' : 'child'
}
