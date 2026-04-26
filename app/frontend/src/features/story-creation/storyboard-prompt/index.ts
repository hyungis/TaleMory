/**
 * Step 3 — 스토리보드 줄거리 생성 (프롬프트 기반 AI 생성) 공용 API.
 *
 * - PromptStep: 화면 컴포넌트
 * - useGenerationJobQuery: 작업 상태 polling hook (이미지 단계도 같은 endpoint 라 storyboard-editor
 *   에서 cross-feature 로 재사용한다 — 후속 cleanup 에서 더 위 레이어로 추출 검토).
 */
export { PromptStep } from './ui/PromptStep'
export { useGenerationJobQuery } from './model/useGenerationJobQuery'
export type { GenerationJobQueryResult } from './model/useGenerationJobQuery'
