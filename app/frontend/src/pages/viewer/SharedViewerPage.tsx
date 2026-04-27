import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { StoryBookViewer, usePublicStoryViewQuery } from '../../features/viewer'
import { InvitationCard } from '../../features/viewer'

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
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0a1a0a] text-[#f0e6c0]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-[#b4dc8c]/30 border-t-[#b4dc8c] rounded-full animate-spin" />
          <p className="text-sm">동화책을 불러오는 중이에요…</p>
        </div>
      </div>
    )
  }
  if (status === 'error' || !story) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0a1a0a] text-[#f0e6c0] px-6">
        <div className="text-center max-w-sm">
          <p className="text-lg mb-3">⚠️ {error?.message ?? '동화를 불러오지 못했어요.'}</p>
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
      />
      {showWebtoonNotice && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setShowWebtoonNotice(false)}
        >
          <div
            className="bg-[#1a2414] border-2 border-[#b4dc8c]/60 rounded-2xl p-6 max-w-sm w-full text-center text-[#f0e6c0] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-2xl mb-2">🚧</p>
            <h3 className="text-xl font-bold mb-2">아직 준비 중이에요</h3>
            <p className="text-sm text-[#b4dc8c] mb-5">웹툰 모드는 다음 업데이트에서 만나보실 수 있어요.</p>
            <button
              onClick={() => setShowWebtoonNotice(false)}
              className="px-5 py-2 rounded-full bg-[#2d5a27] hover:bg-[#3d6f34] text-sm font-bold"
            >
              알겠어요
            </button>
          </div>
        </div>
      )}
    </>
  )
}
