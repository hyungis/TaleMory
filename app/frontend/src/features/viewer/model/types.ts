/**
 * 뷰어 전용 도메인 타입 — BE `GET /api/stories/{storyId}/view` 응답과 1:1 매핑.
 * entities/scene, entities/sentence 와 필드명이 같지만 뷰어 화면 전용 통합 구조라 별도 정의.
 */
import type { PersonId, SceneId, SentenceId, StoryId } from '../../../shared/types'

/**
 * 정규화된 좌표 (0~1) — 이미지 전체에 대한 비율로 표현되는 anchor 점.
 * BE `AnchorPoint` 와 1:1 매핑. NARRATION fallback / 임시 위치 표현용.
 */
export interface AnchorPoint {
  x: number
  y: number
}

export interface MainCharacterView {
  name: string | null
}

/**
 * scene.character_anchors JSON 배열 원소 — 페이지별 캐릭터 anchor.
 *
 * 매칭 규약: FE 는 `sentence.speakerKey === characterAnchor.name` 으로 lookup.
 * NARRATION (sentence.speakerKey == null) → fallback (top center).
 *
 * 레거시 필드 (`characterId`, `scale`) 는 BE 호환을 위해 nullable 로 유지.
 */
export interface CharacterAnchorView {
  /** sentence.speakerKey 와 매칭되는 키. WEBTOON 모드에서 채워짐. */
  name: string | null
  x: number | null
  y: number | null
  /** AI Vision 신뢰도 0~1. */
  confidence: number | null
  /** Legacy. 사용처 없음. */
  characterId: PersonId | null
  /** Legacy. 사용처 없음. */
  scale: number | null
}

export interface SentenceView {
  sentenceId: SentenceId
  sentenceOrder: number
  englishText: string
  koreanText: string | null
  ttsAudioUrl: string | null
  speakerKey: string | null
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
