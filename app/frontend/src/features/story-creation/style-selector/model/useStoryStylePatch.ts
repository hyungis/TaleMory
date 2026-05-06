import { useMutation } from '@tanstack/react-query'
import { patchStoryStyle, type StylePatchResponse } from '../api/patchStoryStyle'

export function useStoryStylePatch(storyId: number | null) {
  return useMutation<StylePatchResponse, Error, number>({
    mutationFn: (stylePresetId: number) => {
      if (storyId === null) return Promise.reject(new Error('storyId is null'))
      return patchStoryStyle(storyId, stylePresetId)
    },
  })
}
