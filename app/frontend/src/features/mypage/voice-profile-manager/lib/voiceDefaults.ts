/**
 * 마이페이지 → 목소리 추가 플로우 상수.
 * 동화 생성의 `features/story-creation/voice-clone/lib/defaults.ts` 와 동일한 스크립트/엔드포인트
 * 를 쓰지만, **localStorage 키만 분리** 해서 두 플로우간 state 누수 방지.
 * (동화 생성 중 녹음한 보이스가 마이페이지 UI 에 섞여 보이지 않게.)
 */

export const VOICE_SAMPLE_SCRIPT =
  '"Hello, Haesol! Are you ready for an amazing adventure in Jeju island? Let\'s go!"'

export const DEFAULT_TTS_TEXT =
  '해솔아, 오늘은 제주 바다에서 만난 작은 돌고래와 함께 신나는 모험을 떠나 볼까?'

/** AI TTS 서버 베이스 URL. 로컬 개발 시 FastAPI 가 이 경로로 뜸. */
export const TTS_API_BASE = import.meta.env.VITE_TTS_API_BASE ?? 'http://127.0.0.1:8000'
/** 클론 TTS 생성 엔드포인트 (멀티파트 POST). */
export const TTS_API_URL = `${TTS_API_BASE}/tts`

// 동화 생성 플로우의 키('talemory_voice_recording', 'talemory_voice_tts') 와 충돌 금지.
export const VOICE_STORAGE_KEY = 'talemory_mypage_voice_recording'
export const TTS_STORAGE_KEY = 'talemory_mypage_voice_tts'
