/**
 * 외부 노출 도메인 ID 타입 별칭.
 *
 * BE 가 Sqids 로 인코딩한 alphanumeric 토큰 (예: `'tF8jK3x9'`) 으로 내려준다.
 * FE 는 토큰을 opaque 문자열로만 다룬다 — 형식 검증/순서 추정 금지.
 *
 * 운영 정책:
 *  - 이 별칭들은 모두 `string` — TypeScript 구조적 타이핑 덕에 코드 변경은 최소화.
 *  - BE Phase 1 호환 모드라 raw BIGINT 문자열도 허용되지만 (e.g. `'42'`),
 *    FE 는 BE 응답 토큰을 그대로 받아 그대로 보내는 흐름이라 raw 형식을 직접 만들 일은 없다.
 *
 * userId / pageNumber / version 등 BE 가 인코딩하지 않는 internal 식별자는 그대로 number 유지.
 */
export type StoryId = string
export type JobId = string
export type SceneId = string
export type SentenceId = string
export type PhotoId = string
export type VoiceProfileId = string
export type PersonId = string
