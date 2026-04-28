import { patch } from '../../../../shared/api'
import type { StoryBoardSnapshot, UpdateStoryboardSummaryRequest } from './types'

/**
 * `PATCH /api/stories/{storyId}/storyboard/summary` — 옵션 ② 디자인.
 *
 * 사용자가 Step 3 result 화면의 한글 줄거리 textarea 를 편집하면 onBlur 시 호출된다.
 * BE 는 stories.synopsis / story_board.story / 최신 SUMMARY 잡의 result_payload.summaryKo
 * 세 곳에 sync 후 본문 발행 시 한글 ground 로 활용한다.
 */
export function patchStoryboardSummary(
  storyId: number,
  body: UpdateStoryboardSummaryRequest,
): Promise<StoryBoardSnapshot> {
  return patch<StoryBoardSnapshot>(`/stories/${storyId}/storyboard/summary`, body)
}
