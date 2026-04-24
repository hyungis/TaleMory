/**
 * 마이페이지 주인공/동행자 섹션 목업 데이터.
 * 실제 API 연동 전 화면 레이아웃/인터랙션 확인용.
 * TODO: API 연동 후 삭제하고 usePersons 훅으로 대체.
 */

import type { Person } from '../../../../entities/person'

export const mockPersons: Person[] = [
  { id: 101, userId: 1, name: '김별', birthDate: '2019-05-10', gender: 'female', role: 'child' },
  { id: 102, userId: 1, name: '김달', birthDate: '2022-03-22', gender: 'male', role: 'child' },
  { id: 201, userId: 1, name: '엄마', birthDate: '1988-11-03', gender: 'female', role: 'companion' },
  { id: 202, userId: 1, name: '아빠', birthDate: '1986-07-18', gender: 'male', role: 'companion' },
]
