import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookshelfModal } from '../../../features/bookshelf'
import type { Story } from '../../../entities/story'
import { ROUTES, buildViewerPath } from '../../../shared/constants'
import { getDraftStory } from '../../../features/story-creation/basic-info/api/getDraftStory'
import { deleteStory } from '../../../features/story-creation/basic-info/api/deleteStory'
import type { StoryDraftResponse } from '../../../features/story-creation/basic-info/api/types'
import { DraftResumeModal } from '../../../features/story-creation/basic-info/ui/DraftResumeModal'

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

  const handleOpenLibrary = useCallback(() => {
    setIsLibraryOpen(true)
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

  return (
    <>
      <button type="button" className="back-to-forest-btn" onClick={onBackToForest} aria-label="숲으로 돌아가기">
        <span className="icon" aria-hidden="true">←</span>
      </button>

      <button type="button" className="open-library-btn" onClick={handleOpenLibrary} aria-label="우리 가족 책장 열기">
        <span className="icon" aria-hidden="true">📚</span>
        <span>우리 가족 책장</span>
      </button>

      <button type="button" className="open-mypage-btn" onClick={() => navigate(ROUTES.mypage)} aria-label="마이페이지로 이동">
        <span className="icon" aria-hidden="true">👤</span>
        <span>마이페이지</span>
      </button>

      <img src="/bookstore.png" alt="서점 내부" className="bookstore-bg" draggable={false} />

      {/* TODO(S14P31S210-76, Task 4~8): steps-container (STEP 0: 책장 대시보드, STEP 1~5: 제작 플로우) */}

      <BookshelfModal
        isOpen={isLibraryOpen}
        onClose={handleCloseLibrary}
        onCreateStory={handleCreateStory}
        onReadStory={handleReadStory}
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-[#8b3a2a] text-[#f0e6c0] px-5 py-3 rounded-full shadow-lg text-sm">
          {draftError}
        </div>
      )}
    </>
  )
}
