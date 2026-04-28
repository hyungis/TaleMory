export const VOICE_SAMPLE_SCRIPT =
  '"Hello, Haesol! Are you ready for an amazing adventure in Jeju island? Let\'s go!"'

export const DEFAULT_TTS_TEXT =
  '해솔아, 오늘은 제주 바다에서 만난 작은 돌고래와 함께 떠나는 모험을 떠나 볼까?'

export const TTS_API_BASE = import.meta.env.VITE_TTS_API_BASE ?? 'http://127.0.0.1:8000'
export const TTS_API_URL = `${TTS_API_BASE}/tts`
