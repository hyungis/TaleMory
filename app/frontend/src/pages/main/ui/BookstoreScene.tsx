import { useCallback, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { LogoutButton } from '../../../features/auth'
import { BookshelfModal, getMyStories, deleteStoryById, getShareLink, publishStory, mapApiToStory } from '../../../features/bookshelf'
import type { Story } from '../../../entities/story'
import { ROUTES, buildViewerPath } from '../../../shared/constants'
import {
  getDraftStory,
  deleteStory,
  DraftResumeModal,
} from '../../../features/story-creation'
import type { StoryDraftResponse } from '../../../features/story-creation'

interface BookstoreSceneProps {
  onBackToForest: () => void
}

/**
 * 서점(Bookstore) 씬.
 *
 * - `/bookstore.png` 배경 (bookstoreEntry 키프레임으로 scale-in)
 * - 좌상단: 숲으로 돌아가기 버튼
 * - 우상단: "우리 가족 책장" 버튼 → `BookshelfModal` 오픈
 * - "새 동화책 만들기" 클릭 시 서버의 DRAFT 존재 여부로 분기:
 *    - DRAFT 있음 → `DraftResumeModal` 로 이어서/새로 선택
 *    - 없음 → 바로 /creation (빈 상태)
 */
export function BookstoreScene({ onBackToForest }: BookstoreSceneProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [draft, setDraft] = useState<StoryDraftResponse | null>(null)
  const [isResolvingDraft, setIsResolvingDraft] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [storiesLoading, setStoriesLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 2500)
  }, [])

  const handleOpenLibrary = useCallback(async () => {
    setIsLibraryOpen(true)
    setStoriesLoading(true)
    try {
      const result = await getMyStories()
      setStories(result.map(mapApiToStory))
    } catch {
      // API 실패 시 빈 목록 표시
      setStories([])
    } finally {
      setStoriesLoading(false)
    }
  }, [])

  const handleCloseLibrary = useCallback(() => {
    setIsLibraryOpen(false)
  }, [])

  const navigate = useNavigate()

  /**
   * "새 동화책 만들기" 버튼 진입점.
   *  1) 서버에 진행 중 DRAFT 가 있는지 조회 (GET /api/stories/draft)
   *  2) 있으면 DraftResumeModal 오픈 → onResume / onStartNew 에서 실제 네비게이션
   *  3) 없으면 빈 상태로 바로 /creation 진입
   *
   * 네트워크 실패 시엔 빈 상태로 진입하는 것이 최악의 UX 이므로,
   * 에러 뱃지를 노출하고 기존(empty) 플로우로 폴백한다.
   */
  const handleCreateStory = useCallback(async () => {
    if (isResolvingDraft) return
    setDraftError(null)
    setIsResolvingDraft(true)
    try {
      const result = await getDraftStory()
      if (result) {
        setDraft(result)
        setIsLibraryOpen(false)
        return
      }
      // DRAFT 없음 — 바로 진입 (empty state)
      setIsLibraryOpen(false)
      navigate(ROUTES.creation)
    } catch (err) {
      // 조회 실패 → 기존 동작(빈 상태 진입) 으로 폴백.
      const message = err instanceof Error ? err.message : '초안 조회에 실패했습니다.'
      setDraftError(message)
      setIsLibraryOpen(false)
      navigate(ROUTES.creation)
    } finally {
      setIsResolvingDraft(false)
    }
  }, [isResolvingDraft, navigate])

  /** 이어서 작성 — location state 로 draft 넘겨 CreationPage 가 rehydrate. */
  const handleResumeDraft = useCallback(() => {
    if (!draft) return
    setDraft(null)
    navigate(ROUTES.creation, { state: { draft } })
  }, [draft, navigate])

  /** 새로 시작 — 기존 DRAFT soft delete 후 빈 상태로 진입. */
  const handleStartNew = useCallback(async () => {
    if (!draft || isResolvingDraft) return
    setIsResolvingDraft(true)
    setDraftError(null)
    try {
      await deleteStory(draft.storyId)
      setDraft(null)
      navigate(ROUTES.creation)
    } catch (err) {
      const message = err instanceof Error ? err.message : '초안 삭제에 실패했습니다.'
      setDraftError(message)
    } finally {
      setIsResolvingDraft(false)
    }
  }, [draft, isResolvingDraft, navigate])

  const handleCloseDraftModal = useCallback(() => {
    setDraft(null)
  }, [])

  const handleReadStory = useCallback(
    (story: Story) => {
      setIsLibraryOpen(false)
      navigate(buildViewerPath(story.id))
    },
    [navigate],
  )

  const handleDeleteStory = useCallback(async (story: Story) => {
    if (!window.confirm(`"${story.title}" 을(를) 정말 삭제하시겠어요?`)) return
    try {
      await deleteStoryById(story.id)
      setStories(prev => prev.filter(s => s.id !== story.id))
      showToast('동화가 삭제되었습니다.')
    } catch {
      showToast('삭제에 실패했습니다.')
    }
  }, [showToast])

  const handleShareStory = useCallback(async (story: Story) => {
    try {
      let shareData: { shareToken: string; shareUrl: string }
      if (story.status === 'PUBLISHED') {
        shareData = await getShareLink(story.id)
      } else {
        shareData = await publishStory(story.id)
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, status: 'PUBLISHED', shareToken: shareData.shareToken } : s))
      }
      const fullUrl = `${window.location.origin}${shareData.shareUrl}`
      await navigator.clipboard.writeText(fullUrl)
      showToast('공유 링크가 복사되었습니다!')
    } catch {
      showToast('공유 링크 생성에 실패했습니다.')
    }
  }, [showToast])

  return (
    <>
      <button type="button" className="back-to-forest-btn" onClick={onBackToForest} aria-label="숲으로 돌아가기">
        <ArrowLeft className="icon" aria-hidden="true" />
      </button>

      {/* 우상단 버튼 그룹 — CSS flex 컨테이너 */}
      <div className="bookstore-action-buttons">
        <button type="button" className="bookstore-action-btn" onClick={handleOpenLibrary} aria-label="우리 가족 책장 열기">
          <span className="icon" aria-hidden="true">📚</span>
          <span>우리 가족 책장</span>
        </button>

        <button type="button" className="bookstore-action-btn" onClick={() => navigate(ROUTES.mypage)} aria-label="마이페이지로 이동">
          <span className="icon" aria-hidden="true">👤</span>
          <span>마이페이지</span>
        </button>

        <LogoutButton />
      </div>

      <img src="/bookstore.png" alt="서점 배경" className="bookstore-bg" draggable={false} />

      <BookshelfModal
        isOpen={isLibraryOpen}
        onClose={handleCloseLibrary}
        onCreateStory={handleCreateStory}
        onReadStory={handleReadStory}
        onShareStory={handleShareStory}
        onDeleteStory={handleDeleteStory}
        stories={stories}
        isLoading={storiesLoading}
      />

      {draft && (
        <DraftResumeModal
          draft={draft}
          onResume={handleResumeDraft}
          onStartNew={handleStartNew}
          onClose={handleCloseDraftModal}
          isSubmitting={isResolvingDraft}
        />
      )}

      {draftError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[6000] bg-[#8b3a2a] text-[#f0e6c0] px-5 py-3 rounded-full shadow-lg text-sm">
          {draftError}
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[6000] bg-[#2d5a27] text-[#f0e6c0] px-5 py-3 rounded-full shadow-lg text-sm font-bold">
          {toastMessage}
        </div>
      )}
    </>
  )
}
