import { deleteRequest } from '../../../../shared/api'

/**
 * DELETE /api/stories/{id} — 동화 소프트 삭제.
 * "새로 시작하기" 플로우에서 기존 DRAFT 를 정리할 때 호출한다.
 * 응답 body 는 `{ success: true, data: null }` 로 내려오므로 void 로 취급.
 */
export function deleteStory(id: number): Promise<void> {
  return deleteRequest<void>(`/stories/${id}`)
}
