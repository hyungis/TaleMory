/**
 * Person 도메인 — `persons` 테이블(role: child/companion) 대응.
 * V10 마이그레이션 이후 birth_date 대신 age (만 나이) 를 그대로 저장한다.
 */

export type PersonRole = 'child' | 'companion'

export interface Person {
  id: number
  userId: number
  name: string
  age: number
  gender?: 'male' | 'female' | 'other'
  role: PersonRole
}
