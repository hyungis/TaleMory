/**
 * basic-info API 계약 — BE(DTO) 와 1:1 정합.
 *
 * ⚠ entities/person 의 Person 타입은 소문자 enum(`child`/`male`)로 정의돼 있으나,
 *   BE 실제 응답은 대문자(`CHILD`/`MALE`) 이므로 이 레이어에서 별도 타입을 유지한다.
 *   (entity 수정은 다른 도메인 영향 우려로 이번 MR 범위 밖)
 */

export type PersonGender = 'MALE' | 'FEMALE' | 'OTHER'
export type PersonRoleApi = 'CHILD' | 'COMPANION'
export type DifficultyApi = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

/** GET /api/persons 응답 원소 / POST/PATCH 성공 시 반환 페이로드. */
export interface PersonResponse {
  id: number
  name: string
  /** ISO-8601 (YYYY-MM-DD). */
  birthDate: string
  gender: PersonGender
  role: PersonRoleApi
}

/** POST /api/persons request body. */
export interface CreatePersonRequest {
  name: string
  birthDate: string
  gender: PersonGender
  role: PersonRoleApi
}

/** PATCH /api/persons/{id} request body (모든 필드 optional). */
export interface ModifyPersonRequest {
  name?: string
  birthDate?: string
  gender?: PersonGender
}

/** POST /api/stories request body. `companionsJson`/`mainCharacterJson` 은 FE 에서 JSON.stringify 한 문자열. */
export interface CreateStoryRequest {
  title: string | null
  difficulty: DifficultyApi
  companionsJson: string
  mainCharacterJson: string
  travelPlace?: string | null
  travelStartDate?: string | null
  travelEndDate?: string | null
}

/** POST /api/stories 응답 — storyId 만 필요. */
export interface StoryCreateResponse {
  storyId: number
}
