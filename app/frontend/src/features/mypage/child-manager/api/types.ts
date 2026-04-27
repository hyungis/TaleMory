import type { Person } from '../../../../entities/person'

export type PersonGenderApi = 'MALE' | 'FEMALE' | 'OTHER'
export type PersonRoleApi = 'CHILD' | 'COMPANION'

export interface PersonResponse {
  id: number
  name: string
  birthDate: string
  gender: PersonGenderApi
  role: PersonRoleApi
}

export interface CreatePersonRequest {
  name: string
  birthDate: string
  gender: PersonGenderApi
  role: PersonRoleApi
}

export interface UpdatePersonRequest {
  name?: string
  birthDate?: string
  gender?: PersonGenderApi
}

export function mapPerson(payload: PersonResponse, userId: number): Person {
  return {
    id: payload.id,
    userId,
    name: payload.name,
    birthDate: payload.birthDate,
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
