import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { InvitationCard, StoryBookViewer, useStoryViewQuery } from '../../features/viewer'
import { ROUTES } from '../../shared/constants'

/**
 * `/viewer/:storyId` 라우트.
 * `?mode=book` 쿼리 유무로 청첩장 / 동화책 뷰어 분기.
 *
 * 현재 로그인/토큰 인프라 미완이라 `isOwner=true` 고정 — shareToken 기반 공개 라우트가
 * 추가되면 InvitationCard 에 `isOwner={false}` 로 재사용.
 */
export function ViewerPage() {
  const { storyId } = useParams<{ storyId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = searchParams.get('mode')

  const parsedId = storyId ? Number(storyId) : undefined
  const { status, data: story, error } = useStoryViewQuery(parsedId)

  const [showWebtoonNotice, setShowWebtoonNotice] = useState(false)

  if (status === 'loading' || status === 'idle') {
    return <ViewerLoadingState />
  }
  if (status === 'error' || !story) {
    return <ViewerErrorState message={error?.message ?? '동화를 불러오지 못했어요.'} onBack={() => navigate(ROUTES.main)} />
  }

  const openBookMode = () => {
    // 주소창/탭바 없는 전용 뷰어 창으로 띄움 — e-book 리더 몰입감.
    const url = `${window.location.pathname}?mode=book`
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
      setSearchParams({ mode: 'book' })
    }
  }
  const openWebtoonMode = () => {
    setShowWebtoonNotice(true)
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

  return (
    <>
      <InvitationCard
        story={story}
        isOwner
        onOpenBook={openBookMode}
        onOpenWebtoon={openWebtoonMode}
      />
      {showWebtoonNotice && (
        <WebtoonNoticeModal onClose={() => setShowWebtoonNotice(false)} />
      )}
    </>
  )
}

function ViewerLoadingState() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a1a0a] text-[#f0e6c0]">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-4 border-[#b4dc8c]/30 border-t-[#b4dc8c] rounded-full animate-spin" />
        <p className="text-sm">동화책을 불러오는 중이에요…</p>
      </div>
    </div>
  )
}

function ViewerErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a1a0a] text-[#f0e6c0] px-6">
      <div className="text-center max-w-sm">
        <p className="text-lg mb-3">⚠️ {message}</p>
        <button onClick={onBack} className="px-5 py-2 rounded-full bg-[#2d5a27] hover:bg-[#3d6f34] text-sm">
          메인으로 돌아가기
        </button>
      </div>
    </div>
  )
}

function WebtoonNoticeModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a2414] border-2 border-[#b4dc8c]/60 rounded-2xl p-6 max-w-sm w-full text-center text-[#f0e6c0] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-2xl mb-2">🚧</p>
        <h3 className="text-xl font-bold mb-2">아직 준비 중이에요</h3>
        <p className="text-sm text-[#b4dc8c] mb-5">웹툰 모드는 다음 업데이트에서 만나보실 수 있어요.</p>
        <button
          onClick={onClose}
          className="px-5 py-2 rounded-full bg-[#2d5a27] hover:bg-[#3d6f34] text-sm font-bold"
        >
          알겠어요
        </button>
      </div>
    </div>
  )
}
