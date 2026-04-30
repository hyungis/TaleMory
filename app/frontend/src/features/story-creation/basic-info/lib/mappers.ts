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

// V10 마이그레이션 이후 BE 가 birth_date 대신 age (INT) 를 직접 다룸 →
// ageToBirthDate / birthDateToAge 변환 헬퍼는 모두 제거됨.
