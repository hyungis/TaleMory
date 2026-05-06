import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { postStoryboardConfirm, type ConfirmStoryboardResponse } from '../api/postStoryboardConfirm'

/**
 * 스토리보드 confirm (TTS 생성 시작) mutation — `POST /api/stories/{storyId}/storyboard/confirm`.
 *
 * HighlightOutroStep 의 "다음" 버튼 클릭 시 호출.
 * 성공 시 응답의 jobId 로 FinalPreviewStep 에서 TTS 잡 polling 시작.
 */
export function useStoryboardConfirm(): UseMutationResult<ConfirmStoryboardResponse, ApiError, number> {
  return useMutation<ConfirmStoryboardResponse, ApiError, number>({
    mutationFn: storyId => postStoryboardConfirm(storyId),
  })
}
