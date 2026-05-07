import { useMutation } from '@tanstack/react-query'
import { patchStoryStyle, type StylePatchResponse } from '../api/patchStoryStyle'
import type { StoryId } from '../../../../shared/types'

export function useStoryStylePatch(storyId: StoryId | null) {
  return useMutation<StylePatchResponse, Error, number>({
    mutationFn: (stylePresetId: number) => {
      if (storyId === null) return Promise.reject(new Error('storyId is null'))
      return patchStoryStyle(storyId, stylePresetId)
    },
  })
}
