/**
 * basic-info API 계약 — BE(DTO) 와 1:1 정합.
 *
 * ⚠ entities/person 의 Person 타입은 소문자 enum(`child`/`male`)로 정의돼 있으나,
 *   BE 실제 응답은 대문자(`CHILD`/`MALE`) 이므로 이 레이어에서 별도 타입을 유지한다.
 *   (entity 수정은 다른 도메인 영향 우려로 이번 MR 범위 밖)
 */
import type { PersonId, StoryId, VoiceProfileId } from '../../../../shared/types'

export type PersonGender = 'MALE' | 'FEMALE' | 'OTHER'
export type PersonRoleApi = 'CHILD' | 'COMPANION'
export type DifficultyApi = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

/**
 * 동화 생성 모드 — 메인의 "새 동화책 만들기" 클릭 시 모달에서 선택.
 *  - VIEWER: 기존 동화책 모드 (페이지별 narration 본문). 기본값.
 *  - WEBTOON: 대화 중심 웹툰 모드 (sentence 마다 화자 + 캐릭터 위치 메타).
 *
 * BE `StoryMode` enum / AI worker `StoryMode = Literal["VIEWER", "WEBTOON"]` 와 1:1 매칭.
 */
export type StoryModeApi = 'VIEWER' | 'WEBTOON'

/** GET /api/persons 응답 원소 / POST/PATCH 성공 시 반환 페이로드. */
export interface PersonResponse {
  id: PersonId
  name: string
  /** 만 나이 (V10 마이그레이션으로 birth_date 가 age 로 교체됨). */
  age: number
  gender: PersonGender
  role: PersonRoleApi
}

/** POST /api/persons request body. */
export interface CreatePersonRequest {
  name: string
  age: number
  gender: PersonGender
  role: PersonRoleApi
}

/** PATCH /api/persons/{id} request body (모든 필드 optional). */
export interface ModifyPersonRequest {
  name?: string
  age?: number
  gender?: PersonGender
}

/** POST /api/stories request body. `companionsJson`/`mainCharacterJson` 은 FE 에서 JSON.stringify 한 문자열. */
export interface CreateStoryRequest {
  title: string | null
  difficulty: DifficultyApi
  /**
   * 동화 생성 모드. 메인의 모드 선택 모달에서 결정. 누락 시 BE 가 default 'VIEWER'.
   */
  mode?: StoryModeApi
  companionsJson: string
  mainCharacterJson: string
  travelPlace?: string | null
  travelStartDate?: string | null
  travelEndDate?: string | null
}

/** POST /api/stories 응답 — storyId 만 필요. */
export interface StoryCreateResponse {
  storyId: StoryId
}

/**
 * GET /api/stories/draft 응답 — 로그인 유저의 최신 DRAFT 1건.
 * 서버는 DRAFT 없으면 `data: null` 로 내려준다.
 *
 * `stylePresetId`, `voiceProfileId`, `sceneConfirmed` 는 "이어서 작성하기" 진입 시
 * 각 step 의 readOnly 락을 BE 진실 기반으로 복원하기 위한 진행 메타.
 *  - `stylePresetId !== null` → Step 5 락 (스타일 변경 불가)
 *  - `sceneConfirmed === true` → Step 6/7 락 (Step 7→8 confirm 한 번이라도 성공)
 *  - `voiceProfileId` 는 Step 6 voice rehydrate 판단용 (현재는 단순 노출)
 *
 * 크롬 종료 → sessionStorage 비움 → 재진입 시에도 lock 이 유지되도록 보장하기 위해
 * BE 가 진행 상태를 함께 내려준다.
 */
export interface StoryDraftResponse {
  storyId: StoryId
  title: string | null
  difficulty: DifficultyApi
  /** 동화 생성 모드 — VIEWER (기본) / WEBTOON. "이어서 작성하기" 시 모드 복원에 사용. */
  mode: StoryModeApi
  companionsJson: string
  mainCharacterJson: string
  travelPlace: string | null
  travelStartDate: string | null
  travelEndDate: string | null
  /** ISO-8601 (LocalDateTime). 예: "2026-04-22T14:05:03". */
  createdAt: string
  stylePresetId: number | null
  voiceProfileId: VoiceProfileId | null
  sceneConfirmed: boolean
}

/**
 * mainCharacterJson 문자열 파싱 후 원소 타입.
 * BE POST 시 FE 가 직렬화해 보낸 구조 그대로.
 */
export interface MainCharacterPayload {
  personId?: PersonId
  name: string
  age: number
  gender: PersonGender
}

/**
 * PATCH /api/stories/{id} request body — 모든 필드 optional, null/undefined 는 "미변경" 으로 서버에서 해석.
 * BasicInfoStep 재클릭 시 기존 draft row 를 업데이트하기 위해 사용 (중복 DRAFT 방지 + 수정 반영).
 */
export interface ModifyStoryRequest {
  title?: string | null
  difficulty?: DifficultyApi
  companionsJson?: string
  mainCharacterJson?: string
  travelPlace?: string | null
  travelStartDate?: string | null
  travelEndDate?: string | null
}
