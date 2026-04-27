import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookshelfModal, getMyStories, deleteStoryById, getShareLink, publishStory, mapApiToStory } from '../../../features/bookshelf'
import type { Story } from '../../../entities/story'
import { ROUTES, buildViewerPath } from '../../../shared/constants'
import {
  getDraftStory,
  deleteStory,
  DraftResumeModal,
  clearCreationProgressSnapshot,
} from '../../../features/story-creation'
import type { StoryDraftResponse } from '../../../features/story-creation'

interface BookstoreSceneProps {
  /**
   * 현재 씬이 bookstore 로 활성화되어 있는지. forest ↔ bookstore crossfade 를 통과하며
   * 언마운트되지 않으므로(`scene-container.inactive`), false → true 변화를 감지해
   * 매번 모달을 다시 열고 stories 를 refetch 한다. (이 prop 이 없으면 두 번째 진입 시
   * 이전 close 상태가 남아 모달이 안 열림 → 검은 화면 버그.)
   */
  isActive: boolean
  /**
   * BookshelfModal 이 닫혔을 때 ForestScene 으로 자동 복귀 트리거.
   * MainPage 의 `useSceneTransition.backToForest` 가 연결된다.
   */
  onBackToForest: () => void
}

/**
 * "책장(BookshelfModal) 호스트" 씬.
 *
 * 과거에는 `/bookstore.png` 서점 배경 + 좌상단 ← + 우상단 책장 버튼 / 햄버거가 있는
 * 별도 화면이었으나, 디자인 정리 단계에서 "집 클릭 → 즉시 책장 모달" 흐름으로 단순화되며
 * 모달 호스트 역할만 남았다.
 *
 * - 마운트 즉시 BookshelfModal 을 열고 stories 를 fetch
 * - 모달 닫기(외부 클릭/X 버튼/책 읽기 등) → `onBackToForest()` 호출 → ForestScene 으로 복귀
 * - 배경은 `.bookstore-scene { background: #0a100a }` 의 검정이 그대로 backdrop 역할
 *
 * Draft 회복 / 새 동화책 만들기 / 공유 / 삭제 등 비즈니스 로직은 그대로 유지된다.
 */
export function BookstoreScene({ isActive, onBackToForest }: BookstoreSceneProps) {
  // 모달 표시 여부. 마운트 시 isActive 값을 초기값으로 그대로 사용해 첫 렌더부터 모달이 열린 상태가 되도록 한다.
  // (useState(false) 로 시작하면 useEffect 가 fire 하기 전 1 frame 동안 모달 없이 ForestScene 만 보이는
  //  flash 가 발생함 — `/main/bookshelf` 새로고침 시 user-facing flash 의 원인이었음.)
  const [isLibraryOpen, setIsLibraryOpen] = useState(isActive)
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

  /**
   * isActive 가 true 로 바뀔 때마다 모달을 다시 열고 stories 를 fresh 하게 fetch.
   *
   * 컴포넌트 자체는 scene-container 에 의해 unmount 되지 않으므로, prop 변화를 감지해
   * "재진입 = 책장 다시 열기" 의미로 동작시킨다. 이전 close 후 검은 화면 버그 회피용.
   * cancelled 플래그로 진행 중 fetch 가 unmount/비활성 후에도 setState 하지 않도록 보호.
   */
  useEffect(() => {
    if (!isActive) return

    setIsLibraryOpen(true)
    setStoriesLoading(true)

    let cancelled = false
    void getMyStories()
      .then(result => {
        if (cancelled) return
        setStories(result.map(mapApiToStory))
      })
      .catch(() => {
        if (cancelled) return
        setStories([])
      })
      .finally(() => {
        if (cancelled) return
        setStoriesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isActive])

  /** 모달 닫기 시 자동으로 ForestScene 으로 복귀 (별도 ← 버튼이 없으므로). */
  const handleCloseLibrary = useCallback(() => {
    setIsLibraryOpen(false)
    onBackToForest()
  }, [onBackToForest])

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
      // DRAFT 없음 — 바로 진입 (empty state).
      // sessionStorage 의 이전 작업 snapshot 을 비워 stale storyId 가 PATCH 모드를
      // 트리거하지 않도록 명시 reset (특히 dev DB 리셋 후 새 동화 시작 케이스).
      setIsLibraryOpen(false)
      clearCreationProgressSnapshot()
      navigate(ROUTES.creation)
    } catch (err) {
      // 조회 실패 → 기존 동작(빈 상태 진입) 으로 폴백.
      const message = err instanceof Error ? err.message : '초안 조회에 실패했습니다.'
      setDraftError(message)
      setIsLibraryOpen(false)
      clearCreationProgressSnapshot()
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
      // 서버 DRAFT 를 지웠으니 sessionStorage 의 옛 storyId snapshot 도 명시 reset.
      clearCreationProgressSnapshot()
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
