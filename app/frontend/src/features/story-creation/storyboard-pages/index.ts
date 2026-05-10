/**
 * 스토리보드 페이지 단위 데이터 — Step 3 / Step 4 공용 sub-feature.
 *
 * 책임:
 *  - GET /storyboard/pages
 *  - PATCH /storyboard/pages/{n}
 *  - POST /storyboard/images (배치 이미지 생성)
 *  - POST /storyboard/pages/{n}/image/regenerate (단일 재생성)
 *  - React Query 캐시 키 (`storyboard-pages`) 관리
 *
 * UI 컴포넌트는 두지 않는다 — 화면 책임은 storyboard-prompt(Step3) / storyboard-editor(Step4) 에.
 */
export { getStoryboardPages } from './api/getStoryboardPages'
export { patchStoryboardPage } from './api/patchStoryboardPage'
export { postGenerateStoryboardImages } from './api/postGenerateStoryboardImages'
export { postRegenerateStoryboardImage } from './api/postRegenerateStoryboardImage'
export { getStoryboardPageImageVersions } from './api/getStoryboardPageImageVersions'
export { postSelectStoryboardPageImageVersion } from './api/postSelectStoryboardPageImageVersion'
export { getStoryboardRegenStatus } from './api/getStoryboardRegenStatus'

export { useStoryboardPagesQuery } from './model/useStoryboardPagesQuery'
export { useStoryboardPagePatch } from './model/useStoryboardPagePatch'
export { useGenerateStoryboardImagesPost } from './model/useGenerateStoryboardImagesPost'
export { useRegenerateStoryboardImagePost } from './model/useRegenerateStoryboardImagePost'
export { useStoryboardPageImageVersionsQuery } from './model/useStoryboardPageImageVersionsQuery'
export { useSelectStoryboardPageImageVersionPost } from './model/useSelectStoryboardPageImageVersionPost'
export { useStoryboardRegenStatusQuery } from './model/useStoryboardRegenStatusQuery'

export type {
  StoryboardPageItem,
  StoryboardPagesResponse,
  StoryboardSentenceItem,
  WebtoonCharacterInScene,
  WebtoonSentenceType,
  UpdateStoryboardPageRequest,
  UpdateStoryboardPageResponse,
  RegenerateStoryboardImageRequest,
  JobStartResponse,
  StoryboardImageVersionEntry,
  StoryboardImageVersionsResponse,
  SelectStoryboardImageVersionRequest,
  StoryboardRegenStatusResponse,
} from './api/types'

export { WebtoonDialoguePreview } from './ui/WebtoonDialoguePreview'
export { WebtoonSentenceEditor } from './ui/WebtoonSentenceEditor'
