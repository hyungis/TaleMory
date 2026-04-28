/**
 * 원본 story-forest 의 보이스 클론 상수를 이관.
 */

/** 서버 응답 전 fallback 스크립트. 실제 스크립트는 GET /api/voice-recording-script 에서 아이 이름 주입. */
export const VOICE_SAMPLE_SCRIPT =
  'Hello, my dear! This story is for you. ' +
  'That quick beige fox jumped over each lazy dog, shouting through the thin valley. ' +
  'She whispered soft thoughts about azure skies and emerald trees. ' +
  'Zealous children gathered near ancient temples, listening to strange stories about hidden treasures.'

export const DEFAULT_TTS_TEXT =
  '해솔아, 오늘은 제주 바다에서 만난 작은 돌고래와 함께 신나는 모험을 떠나 볼까?'

/** AI TTS 서버 베이스 URL. 로컬 개발 시 FastAPI 가 이 경로로 뜸. */
export const TTS_API_BASE = 'http://127.0.0.1:8000'
/** 클론 TTS 생성 엔드포인트 (멀티파트 POST). */
export const TTS_API_URL = `${TTS_API_BASE}/tts`

export const VOICE_STORAGE_KEY = 'talemory_voice_recording'
export const TTS_STORAGE_KEY = 'talemory_voice_tts'
