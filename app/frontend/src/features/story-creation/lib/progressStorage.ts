/**
 * 동화 제작 플로우의 sessionStorage 진행 snapshot 관리.
 *
 * 같은 탭 안에서 새로고침 / step 사이 이동 시 currentStep / storyId / step3.story 를 보존하기 위함.
 * - useStoryCreationFlow 가 hook 내부에서 read/write
 * - BookstoreScene 등 외부 진입점에서 "신규 시작" / "stale storyId 회복" 시 명시 clear 호출
 *
 * sessionStorage 사용 이유:
 *  - 탭 단위 격리 (다중 탭 동시 작업 누수 차단)
 *  - 탭 닫으면 자동 소멸. 서버에는 DRAFT 가 남아 "이어서 작성하기" 흐름으로 복구 가능.
 */
export const CREATION_PROGRESS_STORAGE_KEY = 'talemory.creation.progress.v1'

/**
 * 진행 snapshot 제거.
 *
 * 호출 타이밍:
 *  - 책장의 "새 동화책 만들기" 진입 (DRAFT 없음 / 폴백 / "새로 시작" 모두)
 *  - publish 완료
 *  - BasicInfoStep PATCH 가 404 받은 stale storyId 회복 시
 */
export function clearCreationProgressSnapshot(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(CREATION_PROGRESS_STORAGE_KEY)
}
