import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import type { VoiceProfileId } from '../../../../shared/types'
import { deleteVoiceProfile } from '../api/deleteVoiceProfile'

export function useVoiceProfileDelete() {
  const queryClient = useQueryClient()

  return useMutation<void, ApiError, VoiceProfileId>({
    mutationFn: deleteVoiceProfile,
    onSuccess: (_data, voiceProfileId) => {
      queryClient.invalidateQueries({ queryKey: ['voiceProfiles'] })
      queryClient.removeQueries({ queryKey: ['voiceProfile', voiceProfileId] })
    },
  })
}
