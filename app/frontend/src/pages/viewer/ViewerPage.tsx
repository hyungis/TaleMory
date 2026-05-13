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
 * `?mode=book` / `?mode=webtoon` 쿼리로 청첩장 / 동화책 / 웹툰 뷰어 분기.
 *
 * 현재 로그인/토큰 인프라 미완이라 `isOwner=true` 고정 — shareToken 기반 공개 라우트가
 * 추가되면 InvitationCard 에 `isOwner={false}` 로 재사용.
 *
 * 온보딩 튜토리얼용 미리보기 라우트(`/onboarding-viewer-preview`) 는 별도 분기로
 * `OnboardingViewerPreview` 가 mock 동화로 InvitationCard / StoryBookViewer 를 시연.
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
        onOpenBook={() => {}}
        onOpenWebtoon={() => {}}
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
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = searchParams.get('mode')

  // BE 가 Sqids 토큰으로 storyId 를 발급하므로 더 이상 Number() 코어션 불가 — 문자열 그대로 전달.
  const { status, data: story, error } = useStoryViewQuery(storyId)

  if (status === 'loading' || status === 'idle') {
    return <ViewerLoadingState />
  }
  if (status === 'error' || !story) {
    return <ViewerErrorState message={error?.message ?? '동화를 불러오지 못했어요.'} onBack={() => navigate(ROUTES.main)} />
  }

  const openInPopup = (target: 'book' | 'webtoon') => {
    const url = `${window.location.pathname}?mode=${target}`
    const w = Math.min(1280, window.screen.availWidth - 100)
    const h = Math.min(860, window.screen.availHeight - 100)
    const left = Math.round((window.screen.availWidth - w) / 2)
    const top = Math.round((window.screen.availHeight - h) / 2)
    const popup = window.open(
      url,
      `TaleMoryViewer-${storyId}`,
      `popup=yes,width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    )
    if (!popup) {
      // 브라우저가 팝업 차단 시 같은 탭에서 전환 fallback
      setSearchParams({ mode: target })
    }
  }


  const closeViewer = () => {
    // 팝업으로 열린 창이면 닫고, 직접 URL 진입이면 청첩장으로 복귀
    if (window.opener) {
      window.close()
    } else {
      setSearchParams({})
    }
  }

  if (mode === 'book') {
    return <StoryBookViewer story={story} onExit={closeViewer} />
  }
  if (mode === 'webtoon') {
    return <StoryWebtoonViewer story={story} isOwner onExit={closeViewer} />
  }

  return (
    <InvitationCard
      story={story}
      isOwner
      onOpenBook={() => openInPopup('book')}
      onOpenWebtoon={() => openInPopup('webtoon')}
      onBack={() => navigate(ROUTES.main)}
    />
  )
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
