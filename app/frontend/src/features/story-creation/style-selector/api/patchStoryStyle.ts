import { patch } from '../../../../shared/api/client'

/**
 * `PATCH /api/stories/{storyId}/style` — 삽화 스타일 프리셋 선택.
 * BE 의 StyleModifyRequest `{ stylePresetId: Long }` 와 매칭.
 *
 * 주의: shared/api 의 patch 는 plain object 를 자동 JSON.stringify 한다.
 * 직접 `JSON.stringify(...)` 를 넘기면 BE 가 이중 인코딩된 문자열을 받아 500 으로 떨어진다.
 */
export function patchStoryStyle(storyId: number, stylePresetId: number): Promise<void> {
  return patch<void>(`/stories/${storyId}/style`, { stylePresetId })
}
