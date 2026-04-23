/**
 * FE state(한글/UI 표기) ↔ BE DTO(영문 enum/ISO-8601) 매퍼 모음.
 * BasicInfoStep 이 네트워크 호출 직전에 사용.
 */
import type { Gender, Level } from '../../model/types'
import type { DifficultyApi, PersonGender } from '../api/types'

/** UI 한글 성별 → BE enum. UI 가 두 값만 노출하므로 OTHER 는 생성 경로에서 사용 안 함. */
export function storyChildGenderToApi(gender: Gender): PersonGender {
  return gender === '남자' ? 'MALE' : 'FEMALE'
}

/** BE enum → UI 한글 성별. OTHER 는 UI 에 없으므로 임의로 '남자' 로 매핑(변경 여지 있음). */
export function apiGenderToStoryChild(gender: PersonGender): Gender {
  if (gender === 'FEMALE') return '여자'
  return '남자'
}

/** UI 영어 레벨(한글) → BE Difficulty enum. */
export function levelToDifficulty(level: Level): DifficultyApi {
  switch (level) {
    case '초급':
      return 'BEGINNER'
    case '중급':
      return 'INTERMEDIATE'
    case '고급':
      return 'ADVANCED'
  }
}

/** BE Difficulty enum → UI 한글 레벨. "이어서 작성하기" rehydrate 경로에서 사용. */
export function difficultyToLevel(difficulty: DifficultyApi): Level {
  switch (difficulty) {
    case 'BEGINNER':
      return '초급'
    case 'INTERMEDIATE':
      return '중급'
    case 'ADVANCED':
      return '고급'
  }
}

/**
 * 나이(정수 문자열) → 근사치 ISO-8601 생년월일.
 * UI 가 birthDate 대신 age 만 받고 있는 MVP 상태라, 서버가 요구하는 NOT NULL birthDate 는
 * `오늘 - age 년` 으로 생성. 정확한 값은 마이페이지에서 사용자가 수정.
 */
export function ageToBirthDate(age: string): string {
  const years = Number.parseInt(age, 10)
  const safeYears = Number.isFinite(years) && years >= 0 ? years : 0
  const d = new Date()
  d.setFullYear(d.getFullYear() - safeYears)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

/**
 * ISO-8601 생년월일 → 만 나이(한국식 아님) 문자열.
 * persons 드롭다운에서 기존 인물 선택 시 UI 의 age 칸을 채우기 위함.
 */
export function birthDateToAge(birthDate: string): string {
  const b = new Date(birthDate)
  if (Number.isNaN(b.getTime())) return ''
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const monthDiff = now.getMonth() - b.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < b.getDate())) {
    age -= 1
  }
  return String(Math.max(age, 0))
}
