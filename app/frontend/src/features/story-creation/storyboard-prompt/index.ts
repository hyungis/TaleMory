/**
 * Step 3 — 스토리보드 줄거리(요약) 생성 + 직접 편집 + 본문 발행 trigger 화면 공용 API.
 *
 * - PromptStep: 화면 컴포넌트 (4-state INPUT / LOADING / FAIL / RESULT)
 * - useGenerationJobQuery: 본문(STORY)/이미지(ILLUSTRATION) 등 jobId 단위 polling 훅
 *   (Step 4 가 cross-feature 로 재사용한다 — 후속 cleanup 에서 더 위 레이어로 추출 검토)
 * - useStoryboardSummaryQuery: 줄거리(요약) 상태 polling 훅 (storyId 단위)
 * - useGenerateSummary / useRegenerateSummary: 줄거리 1차 생성 / 자연어 재생성 mutation
 * - useStoryboardSummaryPatch: 줄거리 직접 편집(onBlur) mutation — 옵션 ② 디자인
 * - useStoryboardStateQuery: 본문(STORY) 잡 상태 1회 조회 훅 — Step 4 mount recovery / Step 3 락 회복
 */
export { PromptStep } from './ui/PromptStep'
export { useGenerationJobQuery } from './model/useGenerationJobQuery'
export type { GenerationJobQueryResult } from './model/useGenerationJobQuery'
export { useStoryboardSummaryQuery } from './model/useStoryboardSummaryQuery'
export type { StoryboardSummaryQueryResult } from './model/useStoryboardSummaryQuery'
export { useGenerateSummary } from './model/useGenerateSummary'
export { useRegenerateSummary } from './model/useRegenerateSummary'
export { useStoryboardSummaryPatch } from './model/useStoryboardSummaryPatch'
export { useStoryboardStateQuery } from './model/useStoryboardStateQuery'
export type {
  SummaryResponseData,
  SummaryJobStatus,
  GenerateStoryboardSummaryRequest,
  RegenerateStoryboardSummaryRequest,
  UpdateStoryboardSummaryRequest,
  StoryBoardSnapshot,
  StartGenerationResult,
  StoryboardStateResponse,
} from './api/types'
