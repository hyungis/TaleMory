import { patch } from '../../../../shared/api/client'

export function patchStoryStyle(storyId: number, stylePresetId: number): Promise<void> {
  return patch<void>(`/stories/${storyId}/style`, { stylePresetId })
}
