/**
 * 원본 story-forest 의 보이스 클론 상수를 이관.
 */

/** 서버 응답 전 fallback 스크립트. 실제 스크립트는 GET /api/voice-recording-script 에서 아이 이름 주입. */
export const VOICE_SAMPLE_SCRIPT =
  'Hello, my dear! This story is for you. ' +
  'That quick beige fox jumped over each lazy dog, shouting through the thin valley.'

export const DEFAULT_TTS_TEXT =
  '해솔아, 오늘은 제주 바다에서 만난 작은 돌고래와 함께 신나는 모험을 떠나 볼까?'


export const VOICE_STORAGE_KEY = 'talemory_voice_recording'
export const TTS_STORAGE_KEY = 'talemory_voice_tts'
