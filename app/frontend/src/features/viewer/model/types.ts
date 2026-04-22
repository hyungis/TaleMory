/**
 * 뷰어 전용 도메인 타입 — BE `GET /api/stories/{storyId}/view` 응답과 1:1 매핑.
 * entities/scene, entities/sentence 와 필드명이 같지만 뷰어 화면 전용 통합 구조라 별도 정의.
 */

export type BubbleSlot =
  | 'TOP_LEFT' | 'TOP_CENTER' | 'TOP_RIGHT'
  | 'MIDDLE_LEFT' | 'MIDDLE_CENTER' | 'MIDDLE_RIGHT'
  | 'BOTTOM_LEFT' | 'BOTTOM_CENTER' | 'BOTTOM_RIGHT'

export interface MainCharacterView {
  name: string | null
}

export interface CharacterAnchorView {
  characterId: number | null
  x: number | null
  y: number | null
  scale: number | null
}

export interface SentenceView {
  sentenceId: number
  sentenceOrder: number
  englishText: string
  koreanText: string | null
  ttsAudioUrl: string | null
  speakerKey: string | null
  bubbleSlot: BubbleSlot | null
}

export interface SceneView {
  sceneId: number
  pageNumber: number
  illustrationUrl: string | null
  characterAnchors: CharacterAnchorView[]
  sentences: SentenceView[]
}

export interface OutroView {
  outroText: string
  audioUrl: string | null
  signature: string | null
}

export interface StoryView {
  storyId: number
  title: string | null
  mainCharacter: MainCharacterView | null
  coverIllustrationUrl: string | null
  publishedAt: string | null
  scenes: SceneView[]
  outro: OutroView | null
}
