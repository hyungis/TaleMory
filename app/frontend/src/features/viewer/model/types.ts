/**
 * 뷰어 전용 도메인 타입 — BE `GET /api/stories/{storyId}/view` 응답과 1:1 매핑.
 * entities/scene, entities/sentence 와 필드명이 같지만 뷰어 화면 전용 통합 구조라 별도 정의.
 */
import type { PersonId, SceneId, SentenceId, StoryId } from '../../../shared/types'

/**
 * 정규화된 좌표 (0~1) — 이미지 전체에 대한 비율로 표현되는 anchor 점.
 *
 * BE `AnchorPoint` 와 1:1 매핑.
 *  - WEBTOON 모드 sentence.bubbleSlot 위치 (말풍선 / 캡션).
 *  - VIEWER 모드 또는 좌표 추출 실패 시 sentence.bubbleSlot 은 null —
 *    FE 는 fallback 위치 (top center) 로 렌더 + 재시도 버튼 노출.
 */
export interface AnchorPoint {
  x: number
  y: number
}

export interface MainCharacterView {
  name: string | null
}

export interface CharacterAnchorView {
  characterId: PersonId | null
  x: number | null
  y: number | null
  scale: number | null
}

export interface SentenceView {
  sentenceId: SentenceId
  sentenceOrder: number
  englishText: string
  koreanText: string | null
  ttsAudioUrl: string | null
  speakerKey: string | null
  /**
   * WEBTOON 모드 한정 — 말풍선/캡션 anchor 좌표 (정규화 0~1).
   * VIEWER 모드 또는 좌표 추출 실패 시 null.
   */
  bubbleSlot: AnchorPoint | null
}

export interface SceneView {
  sceneId: SceneId
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

export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export interface StoryView {
  storyId: StoryId
  title: string | null
  /** BE Story.difficulty enum 명. 미지의 값이 와도 InvitationCard 가 string fallback 처리 가능하도록 string 으로 받음. */
  difficulty: Difficulty | string
  mainCharacter: MainCharacterView | null
  coverIllustrationUrl: string | null
  publishedAt: string | null
  scenes: SceneView[]
  outro: OutroView | null
}

/** BE `GET /api/dictionary/words/{word}` 응답 항목. 같은 단어가 품사별로 여러 건 올 수 있다. */
export interface WordEntry {
  word: string
  pos: string | null
  definitionKo: string
  ipa: string | null
  forms: string | null
}
