import type { StoryChild, StoryProject } from '../../model/types'
import type { MainCharacterPayload, StoryDraftResponse } from '../api/types'
import { apiGenderToStoryChild, difficultyToLevel } from './mappers'

/**
 * 서버 DRAFT 페이로드를 `StoryProject['step1']` 모양으로 되돌린다.
 * "이어서 작성하기" 선택 시 `useStoryCreationFlow` 의 초기 state 로 주입된다.
 *
 * NOTE: 파싱 실패(잘못된 JSON) 는 빈 배열/문자열로 폴백. 사용자 진행을 막지 않는다.
 */
export function rehydrateStep1(draft: StoryDraftResponse): StoryProject['step1'] {
  const travelDates: string[] = []
  if (draft.travelStartDate) travelDates.push(draft.travelStartDate)
  if (draft.travelEndDate && draft.travelEndDate !== draft.travelStartDate) {
    travelDates.push(draft.travelEndDate)
  }

  return {
    children: parseChildren(draft.mainCharacterJson),
    companions: parseCompanions(draft.companionsJson),
    level: difficultyToLevel(draft.difficulty),
    travelDates,
    location: draft.travelPlace ?? '',
  }
}

function parseChildren(json: string): StoryChild[] {
  try {
    const parsed = JSON.parse(json) as MainCharacterPayload[]
    if (!Array.isArray(parsed)) return fallbackChildren()
    const children: StoryChild[] = parsed
      .filter(p => p && typeof p.name === 'string' && typeof p.age === 'number')
      .map(p => ({
        name: p.name,
        gender: apiGenderToStoryChild(p.gender),
        age: String(p.age),
        personId: p.personId,
      }))
    return children.length > 0 ? children : fallbackChildren()
  } catch {
    return fallbackChildren()
  }
}

function parseCompanions(json: string): string {
  try {
    const parsed = JSON.parse(json)
    return typeof parsed === 'string' ? parsed : ''
  } catch {
    return ''
  }
}

function fallbackChildren(): StoryChild[] {
  return [{ name: '', gender: '남자', age: '' }]
}
