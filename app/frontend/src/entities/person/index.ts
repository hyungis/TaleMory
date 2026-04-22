/**
 * Person 도메인 — `persons` 테이블(role: child/companion) 대응.
 */

export type PersonRole = 'child' | 'companion'

export interface Person {
  id: number
  userId: number
  name: string
  birthDate?: string
  gender?: 'male' | 'female' | 'other'
  role: PersonRole
}
