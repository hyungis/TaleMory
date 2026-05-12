import { useParams, useSearchParams } from 'react-router-dom'
import { StoryBookViewer, WebtoonViewer, usePublicStoryViewQuery, InvitationCard } from '../../features/viewer'
import '../../features/viewer/invitation/styles/invitation.css'

/**
 * `/shared/:shareToken` 라우트.
 * 비로그인 사용자도 접근 가능한 공개 뷰어.
 */
export function SharedViewerPage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = searchParams.get('mode')

  const { status, data: story, error } = usePublicStoryViewQuery(shareToken)

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="iv-shell">
        <div className="iv-bg-base" aria-hidden="true" />
        <div className="iv-bg-grain" aria-hidden="true" />
        <div className="iv-bg-crayon" aria-hidden="true" />
        <div className="iv-status">
          <div className="iv-status-spinner" aria-hidden="true" />
          <p className="iv-status-text">동화책을 불러오는 중이에요…</p>
        </div>
      </div>
    )
  }
  if (status === 'error' || !story) {
    return (
      <div className="iv-shell">
        <div className="iv-bg-base" aria-hidden="true" />
        <div className="iv-bg-grain" aria-hidden="true" />
        <div className="iv-bg-crayon" aria-hidden="true" />
        <div className="iv-status">
          <span className="iv-status-error-icon" aria-hidden="true">!</span>
          <p className="iv-status-error-msg">{error?.message ?? '동화를 불러오지 못했어요.'}</p>
        </div>
      </div>
    )
  }

  const openBookMode = () => {
    const url = `${window.location.pathname}?mode=book`
    const w = Math.min(1280, window.screen.availWidth - 100)
    const h = Math.min(860, window.screen.availHeight - 100)
    const left = Math.round((window.screen.availWidth - w) / 2)
    const top = Math.round((window.screen.availHeight - h) / 2)
    const popup = window.open(
      url,
      `TaleMoryViewer-shared`,
      `popup=yes,width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    )
    if (!popup) {
      setSearchParams({ mode: 'book' })
    }
  }

  const closeViewer = () => {
    if (window.opener) {
      window.close()
    } else {
      setSearchParams({})
    }
  }

  const handleBack = () => {
    // 비로그인 공개 뷰어 — 직전 페이지가 있으면 뒤로, 없으면 닫기 시도 후 home 으로 fallback.
    if (window.history.length > 1) {
      window.history.back()
    } else if (window.opener) {
      window.close()
    } else {
      window.location.href = '/'
    }
  }

  if (mode === 'book') {
    return <StoryBookViewer story={story} onExit={closeViewer} />
  }

  if (mode === 'webtoon') {
    return <WebtoonViewer story={story} />
  }

  return (
    <InvitationCard
      story={story}
      isOwner={false}
      onOpenBook={openBookMode}
      onOpenWebtoon={() => {
        const url = `${window.location.pathname}?mode=webtoon`
        const w = Math.min(1280, window.screen.availWidth - 100)
        const h = Math.min(860, window.screen.availHeight - 100)
        const left = Math.round((window.screen.availWidth - w) / 2)
        const top = Math.round((window.screen.availHeight - h) / 2)
        const popup = window.open(
          url,
          `TaleMoryWebtoon-shared`,
          `popup=yes,width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
        )
        if (!popup) {
          setSearchParams({ mode: 'webtoon' })
        }
      }}
      onBack={handleBack}
    />
  )
}
