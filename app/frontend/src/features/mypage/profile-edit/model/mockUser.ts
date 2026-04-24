/**
 * 마이페이지 프로필 섹션 목업 데이터.
 * 실제 API 연동 전 화면 레이아웃/인터랙션 확인용.
 * TODO: API 연동 후 삭제하고 useMe 훅으로 대체.
 */

import type { UserProfile } from '../../../../entities/user'

export const mockUser: UserProfile = {
  id: 1,
  loginId: 'talemory_user',
  email: 'user@talemory.io',
  name: '김이포',
  nickname: '이야기짓는이',
  phone: '010-1234-5678',
  agreeSms: true,
  agreeMarketing: false,
  provider: null,
  createdAt: '2026-01-15T09:00:00Z',
  updatedAt: '2026-04-01T09:00:00Z',
}
