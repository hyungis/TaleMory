/**
 * 원본 story-forest 의 보이스 클론 상수를 이관.
 */

export const VOICE_SAMPLE_SCRIPT =
  '"Hello, Haesol! Are you ready for an amazing adventure in Jeju island? Let\'s go!"'

export const DEFAULT_TTS_TEXT =
  '해솔아, 오늘은 제주 바다에서 만난 작은 돌고래와 함께 신나는 모험을 떠나 볼까?'

/**
 * 백엔드(혹은 AI 서비스)의 TTS 엔드포인트. 로컬 개발 시 FastAPI 가 이 경로로 뜸.
 * 운영 환경에서는 nginx 가 /ai/tts 로 프록시하므로 env 기반으로 교체 필요.
 */
export const TTS_API_URL = import.meta.env.VITE_TTS_API_URL ?? 'http://127.0.0.1:8000/tts'

export const VOICE_STORAGE_KEY = 'talemory_voice_recording'
export const TTS_STORAGE_KEY = 'talemory_voice_tts'
