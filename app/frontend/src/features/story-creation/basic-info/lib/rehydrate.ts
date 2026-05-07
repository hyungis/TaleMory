import type { StoryChild, StoryProject } from '../../model/types'
import type { MainCharacterPayload, StoryDraftResponse } from '../api/types'
import type { VoiceProfileId } from '../../../../shared/types'
import { apiGenderToStoryChild, difficultyToLevel } from './mappers'

/**
 * 서버 DRAFT 의 진행 메타로부터 useStoryCreationFlow 가 lock state 를 복원하는 데
 * 필요한 플래그/값만 추려낸다.
 *
 * 크롬 종료로 sessionStorage 가 비워진 뒤 "이어서 작성하기" 로 다시 진입했을 때,
 * BE 진실 (Story.stylePresetId / Scene 존재) 을 기반으로 Step 5/6/7 의 readOnly 락이
 * 유지되도록 하는 것이 목적이다.
 *
 *  - `stylePresetLocked`     : `stylePresetId !== null` → Step 5 잠금 (스타일 변경 불가)
 *  - `confirmedReadOnly`     : `sceneConfirmed === true` → Step 6/7 잠금 (이미 confirm 됨)
 *  - `voiceProfileId`        : Step 6 재진입 시 voice rehydrate 판단용 원본 값 (옵션)
 */
export interface RehydratedProgress {
  stylePresetLocked: boolean
  confirmedReadOnly: boolean
  voiceProfileId: VoiceProfileId | null
}

export function rehydrateProgress(draft: StoryDraftResponse): RehydratedProgress {
  return {
    stylePresetLocked: draft.stylePresetId !== null,
    confirmedReadOnly: draft.sceneConfirmed === true,
    voiceProfileId: draft.voiceProfileId,
  }
}

/**
 * 서버 DRAFT 페이로드를 `StoryProject['step1']` 모양으로 되돌린다.
 * "이어서 작성하기" 선택 시 `useStoryCreationFlow` 의 초기 state 로 주입된다.
 *
 * NOTE: 파싱 실패(잘못된 JSON) 는 빈 배열/문자열로 폴백. 사용자 진행을 막지 않는다.
 */
export function rehydrateStep1(draft: StoryDraftResponse): StoryProject['step1'] {
  // travelEndDate 가 startDate 와 같아도(당일치기) 둘 다 push 해야
  // step1 복원 시 "당일치기" 상태로 정확히 표시됨. (BasicInfoStep 의 lastDate 계산이
  // length>=2 를 요구하므로, [a, a] 형태여야 endDate prop 이 살아난다.)
  const travelDates: string[] = []
  if (draft.travelStartDate) travelDates.push(draft.travelStartDate)
  if (draft.travelEndDate) travelDates.push(draft.travelEndDate)

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
        personId: typeof p.personId === 'string' ? p.personId : undefined,
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
