/**
 * 마이페이지 화면 구성용 목업 데이터.
 * 실제 API 연동 전 화면 레이아웃/인터랙션 확인용.
 * TODO: API 연동 후 삭제하고 useMe / useVoiceProfiles / usePersons 훅으로 대체.
 */

import type { UserProfile } from '../../../entities/user'
import type { Person } from '../../../entities/person'
import type { VoiceProfile } from '../../../entities/voice-profile'

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

export const mockPersons: Person[] = [
  { id: 101, userId: 1, name: '김별', birthDate: '2019-05-10', gender: 'female', role: 'child' },
  { id: 102, userId: 1, name: '김달', birthDate: '2022-03-22', gender: 'male', role: 'child' },
  { id: 201, userId: 1, name: '엄마', birthDate: '1988-11-03', gender: 'female', role: 'companion' },
  { id: 202, userId: 1, name: '아빠', birthDate: '1986-07-18', gender: 'male', role: 'companion' },
]

export const mockVoiceProfiles: VoiceProfile[] = [
  { id: 301, userId: 1, title: '엄마 목소리', audioUrl: '/mock/mom.wav', ttsVoiceUrl: '/mock/mom-tts.wav' },
  { id: 302, userId: 1, title: '아빠 목소리', audioUrl: '/mock/dad.wav' },
]
