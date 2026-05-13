import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  InvitationCard,
  StoryBookViewer,
  StoryWebtoonViewer,
  useStoryViewQuery,
} from '../../features/viewer'
import type { StoryView } from '../../features/viewer'
import { ROUTES } from '../../shared/constants'
import '../../features/viewer/invitation/styles/invitation.css'

const ONBOARDING_VIEWER_STORY: StoryView = {
  storyId: 'onboarding-preview',
  title: '우리 가족의 여행 동화',
  difficulty: 'BEGINNER',
  mode: 'VIEWER',
  mainCharacter: { name: '하린' },
  coverIllustrationUrl: null,
  publishedAt: null,
  scenes: [
    {
      sceneId: 'onboarding-scene-1',
      pageNumber: 1,
      illustrationUrl: null,
      characterAnchors: [],
      sentences: [
        {
          sentenceId: 'onboarding-sentence-1',
          sentenceOrder: 1,
          englishText: 'Harin opened the family storybook and found a road made of stars.',
          koreanText: '하린이는 가족 동화책을 펼치고 별빛으로 이어진 길을 발견했어요.',
          ttsAudioUrl: null,
          speakerKey: null,
        },
      ],
    },
    {
      sceneId: 'onboarding-scene-2',
      pageNumber: 2,
      illustrationUrl: null,
      characterAnchors: [],
      sentences: [
        {
          sentenceId: 'onboarding-sentence-2',
          sentenceOrder: 1,
          englishText: 'Every page remembered a warm moment from the trip.',
          koreanText: '책장을 넘길 때마다 여행의 따뜻한 순간이 되살아났어요.',
          ttsAudioUrl: null,
          speakerKey: null,
        },
      ],
    },
  ],
  outro: {
    outroText: '오늘의 추억은 오래도록 가족의 이야기로 남을 거예요.',
    audioUrl: null,
    signature: 'TaleMory',
  },
}

type OnboardingViewerMode = 'main' | 'book' | 'tools'

function getOnboardingViewerMode(locationState: unknown): OnboardingViewerMode {
  if (typeof locationState !== 'object' || locationState === null) return 'main'
  if (!('onboardingViewerMode' in locationState)) return 'main'

  const value = (locationState as { onboardingViewerMode?: unknown }).onboardingViewerMode
  return value === 'book' || value === 'tools' ? value : 'main'
}

/**
 * `/viewer/:storyId` 라우트.
 * `?mode=book` / `?mode=webtoon` 쿼리로 동화책 / 웹툰 뷰어 분기.
 * mode 쿼리 없으면 story.mode 로 자동 선택.
 */
export function ViewerPage() {
  const { storyId } = useParams<{ storyId: string }>()
  const location = useLocation()

  if (location.pathname === ROUTES.onboardingViewerPreview) {
    return <OnboardingViewerPreview mode={getOnboardingViewerMode(location.state)} />
  }

  return <ViewerStoryPage storyId={storyId} />
}

function OnboardingViewerPreview({ mode }: { mode: OnboardingViewerMode }) {
  const navigate = useNavigate()

  if (mode === 'main') {
    return (
      <InvitationCard
        story={ONBOARDING_VIEWER_STORY}
        isOwner
        onOpen={() => {}}
        onBack={() => navigate(ROUTES.mainBookshelf)}
      />
    )
  }

  return (
    <StoryBookViewer
      story={ONBOARDING_VIEWER_STORY}
      onExit={() => navigate(ROUTES.mainBookshelf)}
      forceToolbarOpen={mode === 'tools'}
      initialPageIndex={1}
    />
  )
}

function ViewerStoryPage({ storyId }: { storyId?: string }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode')

  const { status, data: story, error } = useStoryViewQuery(storyId)

  if (status === 'loading' || status === 'idle') {
    return <ViewerLoadingState />
  }
  if (status === 'error' || !story) {
    return <ViewerErrorState message={error?.message ?? '동화를 불러오지 못했어요.'} onBack={() => navigate(ROUTES.main)} />
  }

  const closeViewer = () => {
    if (window.opener) {
      window.close()
    } else {
      navigate(ROUTES.main)
    }
  }

  const resolvedMode = mode ?? (story.mode === 'WEBTOON' ? 'webtoon' : 'book')

  if (resolvedMode === 'webtoon') {
    return <StoryWebtoonViewer story={story} isOwner onExit={closeViewer} />
  }
  return <StoryBookViewer story={story} onExit={closeViewer} />
}

function ViewerLoadingState() {
  return (
    <div className="iv-shell">
      <div className="iv-status">
        <div className="iv-status-spinner" aria-hidden="true" />
        <p className="iv-status-text">동화책을 불러오는 중이에요…</p>
      </div>
    </div>
  )
}

function ViewerErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="iv-shell">
      <div className="iv-status">
        <span className="iv-status-error-icon" aria-hidden="true">!</span>
        <p className="iv-status-error-msg">{message}</p>
        <button type="button" onClick={onBack} className="iv-status-back-btn">
          메인으로 돌아가기
        </button>
      </div>
    </div>
  )
}
