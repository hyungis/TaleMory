/**
 * 마이페이지 보이스 프로필 섹션 목업 데이터.
 * 실제 API 연동 전 화면 레이아웃/인터랙션 확인용.
 * TODO: API 연동 후 삭제하고 useVoiceProfiles 훅으로 대체.
 */

import type { VoiceProfile } from '../../../../entities/voice-profile'

export const mockVoiceProfiles: VoiceProfile[] = [
  { id: 301, userId: 1, title: '엄마 목소리', audioUrl: '/mock/mom.wav', ttsVoiceUrl: '/mock/mom-tts.wav' },
  { id: 302, userId: 1, title: '아빠 목소리', audioUrl: '/mock/dad.wav' },
]
