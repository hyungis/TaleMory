import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { StoryBookViewer, usePublicStoryViewQuery } from '../../features/viewer'
import { InvitationCard } from '../../features/viewer'
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

  const [showWebtoonNotice, setShowWebtoonNotice] = useState(false)

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

  return (
    <>
      <InvitationCard
        story={story}
        isOwner={false}
        onOpenBook={openBookMode}
        onOpenWebtoon={() => setShowWebtoonNotice(true)}
        onBack={handleBack}
      />
      {showWebtoonNotice && (
        <div
          role="dialog"
          aria-modal="true"
          className="iv-notice-overlay"
          onClick={() => setShowWebtoonNotice(false)}
        >
          <div className="iv-notice-card" onClick={e => e.stopPropagation()}>
            <p className="iv-notice-emoji" aria-hidden="true">🚧</p>
            <h3 className="iv-notice-title">아직 준비 중이에요</h3>
            <p className="iv-notice-desc">웹툰 모드는 다음 업데이트에서 만나보실 수 있어요.</p>
            <button type="button" onClick={() => setShowWebtoonNotice(false)} className="iv-notice-btn">
              알겠어요
            </button>
          </div>
        </div>
      )}
    </>
  )
}
