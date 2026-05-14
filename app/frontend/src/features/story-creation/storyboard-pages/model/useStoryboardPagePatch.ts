import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import type { ApiError } from '../../../../shared/api'
import { patchStoryboardPage } from '../api/patchStoryboardPage'
import type { StoryboardPagesResponse, UpdateStoryboardPageResponse } from '../api/types'
import type { StoryId } from '../../../../shared/types'

interface PagePatchVariables {
  pageNumber: number
  koreanText: string
}

/**
 * 페이지 한글 본문 수정 mutation.
 *
 * 성공 처리:
 *  1) `setQueryData` 로 **즉시 해당 페이지를 갱신** — invalidate 만 하면 stale mark 후
 *     다음 active 시점 refetch 라 화면 반영이 1 tick 지연될 수 있다. UX 친절성 차원에서 즉시 반영.
 *  2) `invalidateQueries` 로 백그라운드 refetch 트리거 — 번역 진행 중인 영어 본문이 백엔드에서
 *     갱신되면 다음 fetch 가 새 영어를 가져옴 (한글은 setQueryData 단계에서 이미 새 값).
 */
export function useStoryboardPagePatch(
  storyId: StoryId | null,
): UseMutationResult<UpdateStoryboardPageResponse, ApiError, PagePatchVariables> {
  const queryClient = useQueryClient()
  return useMutation<UpdateStoryboardPageResponse, ApiError, PagePatchVariables>({
    mutationFn: ({ pageNumber, koreanText }) => {
      if (storyId === null) throw new Error('storyId 가 없습니다.')
      return patchStoryboardPage(storyId, pageNumber, { koreanText })
    },
    onSuccess: updatedPage => {
      // 1) 즉시 cache 갱신 — 한글 본문 수정이 화면에 바로 반영되도록.
      //    응답은 단일 page (StoryboardPageItem). pages[] 에서 같은 pageNumber 를 갈아끼움.
      queryClient.setQueryData<StoryboardPagesResponse>(
        ['storyboard-pages', storyId],
        old => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map(p =>
              p.pageNumber === updatedPage.pageNumber ? updatedPage : p,
            ),
          }
        },
      )
      // 2) 백그라운드 refetch — 번역 결과 도착 후 영어 갱신을 위해 stale mark + 재조회.
      void queryClient.invalidateQueries({ queryKey: ['storyboard-pages', storyId] })
    },
  })
}
