import { patch } from '../../../../shared/api/client'
import type { StoryId } from '../../../../shared/types'

export function patchBgm(storyId: StoryId, bgmPresetId: number | null): Promise<void> {
  return patch<void>(`/stories/${storyId}/bgm`, { bgmPresetId })
}
