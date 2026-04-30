import { patch } from '../../../../shared/api/client'

export function patchBgm(storyId: number, bgmPresetId: number | null): Promise<void> {
  return patch<void>(`/stories/${storyId}/bgm`, { bgmPresetId })
}
