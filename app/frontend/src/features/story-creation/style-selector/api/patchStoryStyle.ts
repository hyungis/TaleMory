import { patch } from '../../../../shared/api/client'
import type { JobId, StoryId } from '../../../../shared/types'

/**
 * `PATCH /api/stories/{storyId}/style` — 삽화 스타일 프리셋 선택 + FINAL_ILLUSTRATION 잡 자동 enqueue.
 * BE 의 StyleModifyRequest `{ stylePresetId: Long }` 와 매칭.
 *
 * 응답: StyleModifyResponse `{ finalIllustrationJobId: Long }`
 *  - 같은 stylePresetId 재선택 시에도 멱등 가드로 기존 jobId 가 반환된다.
 *  - FE 는 이 jobId 를 store 에 저장해 Step 8 에서 폴링한다.
 *
 * 주의: shared/api 의 patch 는 plain object 를 자동 JSON.stringify 한다.
 * 직접 `JSON.stringify(...)` 를 넘기면 BE 가 이중 인코딩된 문자열을 받아 500 으로 떨어진다.
 */
export interface StylePatchResponse {
  finalIllustrationJobId: JobId
}

export function patchStoryStyle(
  storyId: StoryId,
  stylePresetId: number,
): Promise<StylePatchResponse> {
  return patch<StylePatchResponse>(`/stories/${storyId}/style`, { stylePresetId })
}
