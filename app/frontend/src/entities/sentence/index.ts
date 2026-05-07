/**
 * Scene 내부 개별 문장 — `scene_sentences` 테이블 대응.
 * TTS/하이라이트/번역 토글의 최소 단위.
 */
import type { SceneId, SentenceId } from '../../shared/types'

export interface SceneSentence {
  id: SentenceId
  sceneId: SceneId
  sentenceOrder: number
  englishText: string
  koreanText: string
  ttsAudioUrl?: string
}
