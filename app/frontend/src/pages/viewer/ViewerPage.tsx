import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { DUMMY_STORIES } from '../../entities/story'
import { StoryReader } from '../../features/viewer'
import { DEFAULT_STORYBOARD_PAGES } from '../../features/story-creation'
import { ROUTES } from '../../shared/constants'

/**
 * `/viewer/:storyId` 라우트.
 *
 * 현재(Task 9)는 DUMMY_STORIES 에서 id 매칭 후 title 을 뽑고,
 * 페이지 내용은 DEFAULT_STORYBOARD_PAGES(샘플 10장) 를 그대로 사용.
 * 실 백엔드 연동 시 `useStoryQuery(storyId)` 로 scene/sentence 를 가져와 렌더.
 */
export function ViewerPage() {
  const { storyId } = useParams<{ storyId: string }>()
  const navigate = useNavigate()
  const story = DUMMY_STORIES.find(s => String(s.id) === storyId)

  return (
    <div className="relative w-full h-full">
      <button
        type="button"
        onClick={() => navigate(ROUTES.main)}
        className="absolute top-4 left-4 z-50 w-10 h-10 rounded-full bg-[#2a1b12] text-[#f0e6c0] border-2 border-[#b4dc8c]/50 flex items-center justify-center hover:bg-[#3d5a27] transition-colors"
        aria-label="뒤로가기"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <StoryReader
        title={story?.title ?? '동화책'}
        pages={DEFAULT_STORYBOARD_PAGES}
      />
    </div>
  )
}
