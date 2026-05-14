import { useCallback, useEffect, useState } from 'react'
// (요정 전환 연출은 일시적으로 비활성화 — 추후 Lottie 로 교체 예정.
//  관련 CSS / public/fairy*.png / public/book.png 는 그대로 두어 손쉽게 재활성화 가능.)
import { useNavigate } from 'react-router-dom'
import { BookshelfModal, getMyStories, deleteStoryById, getShareLink, publishStory, mapApiToStory } from '../../../features/bookshelf'
import type { Story } from '../../../entities/story'
import { ROUTES, buildViewerPath } from '../../../shared/constants'
import {
  getDraftStory,
  deleteStory,
  DraftResumeModal,
  DraftResumeBanner,
  StoryModeSelectModal,
  clearCreationProgressSnapshot,
} from '../../../features/story-creation'
import type { StoryDraftResponse, StoryModeApi } from '../../../features/story-creation'
import { TopRightMenu } from './TopRightMenu'

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
  // 진행 중인 동화 — 책장 진입 시 fetch 해서 배너로 항상 노출.
  const [draft, setDraft] = useState<StoryDraftResponse | null>(null)
  // "새 동화책 만들기" 클릭 + draft 가 있는 경우 노출되는 confirm 모달 표시 여부.
  // (배너의 "이어서 만들기" 는 모달을 거치지 않고 바로 navigate.)
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false)
  // draft 가 없거나 폐기된 직후 띄우는 "동화 생성 모드 선택" 모달.
  // VIEWER / WEBTOON 둘 중 하나를 고르면 navigate(/creation, {state:{mode}}) 로 진입.
  const [isModeModalOpen, setIsModeModalOpen] = useState(false)
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
   * isActive 가 true 로 바뀔 때마다 모달을 다시 열고 stories + draft 를 fresh 하게 fetch.
   *
   * 컴포넌트 자체는 scene-container 에 의해 unmount 되지 않으므로, prop 변화를 감지해
   * "재진입 = 책장 다시 열기" 의미로 동작시킨다. 이전 close 후 검은 화면 버그 회피용.
   *
   * 두 fetch 는 독립이라 Promise.all 로 병렬 호출. cancelled 플래그로 진행 중 fetch 가
   * unmount/비활성 후에도 setState 하지 않도록 보호.
   */
  useEffect(() => {
    if (!isActive) return

    setIsLibraryOpen(true)
    setStoriesLoading(true)

    let cancelled = false

    void getMyStories()
      .then(result => {
        if (cancelled) return
        // 책장에는 published 된 동화만 표시 — 진행 중(DRAFT) 은 상단 배너가 담당.
        const published = result.filter(s => s.publishedAt !== null)
        setStories(published.map(mapApiToStory))
      })
      .catch(() => {
        if (cancelled) return
        setStories([])
      })
      .finally(() => {
        if (cancelled) return
        setStoriesLoading(false)
      })

    // 진행 중인 동화 — 배너 표시용. 실패는 silent(배너만 안 뜸).
    void getDraftStory()
      .then(result => {
        if (cancelled) return
        setDraft(result)
      })
      .catch(() => {
        if (cancelled) return
        setDraft(null)
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
   *
   * draft 는 이미 책장 진입 시 fetch 되어 state 에 있으므로, 재조회 없이 그대로 분기.
   *  - draft 있음 → DraftResumeModal 오픈 (사용자가 "새로 시작" 확정 시 polling 으로 mode 모달까지)
   *  - draft 없음 → mode 선택 모달 오픈 → 선택 후 /creation 진입
   *
   * NOTE: 배너의 "이어서 만들기" 는 모달을 거치지 않고 직접 handleResumeDraft 호출 →
   *       빠른 resume 경로. 이 함수는 "새로 시작" 이 가능한 모달 흐름 전용.
   */
  const handleCreateStory = useCallback(() => {
    setDraftError(null)
    if (draft) {
      // 책장 그대로 둔 채 DraftResumeModal 을 위에 띄움.
      setIsDraftModalOpen(true)
      return
    }
    // draft 없음 → 즉시 mode 선택 모달 오픈. navigate 는 mode 선택 후 일어남.
    setIsModeModalOpen(true)
  }, [draft])

  /** 이어서 작성 — 배너/모달 둘 다에서 사용. location state 로 draft 넘겨 CreationPage 가 rehydrate. */
  const handleResumeDraft = useCallback(() => {
    if (!draft) return
    const target = draft
    setDraft(null)
    setIsDraftModalOpen(false)
    navigate(ROUTES.creation, { state: { draft: target } })
  }, [draft, navigate])

  /**
   * 새로 시작 — 기존 DRAFT soft delete 후 mode 선택 모달로 넘김.
   *  - delete 성공 시: DraftResumeModal 닫고 → mode 선택 모달 오픈
   *  - delete 실패 시: 에러 토스트 표시, draft 는 유지
   */
  const handleStartNew = useCallback(async () => {
    if (!draft || isResolvingDraft) return
    setIsResolvingDraft(true)
    setDraftError(null)
    try {
      await deleteStory(draft.storyId)
      setDraft(null)
      setIsDraftModalOpen(false)
      // 서버 DRAFT 를 지웠으니 sessionStorage 의 옛 storyId snapshot 도 명시 reset.
      clearCreationProgressSnapshot()
      // navigate 대신 mode 선택 모달 → 사용자가 모드 결정 후 진입.
      setIsModeModalOpen(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : '초안 삭제에 실패했습니다.'
      setDraftError(message)
    } finally {
      setIsResolvingDraft(false)
    }
  }, [draft, isResolvingDraft])

  /** 모달만 닫음 — draft state 는 유지해 배너가 그대로 보이도록. */
  const handleCloseDraftModal = useCallback(() => {
    setIsDraftModalOpen(false)
  }, [])

  /**
   * 모드 선택 완료 → /creation 진입.
   * 진입 직전 sessionStorage 의 옛 progress snapshot 을 정리 (이전 동화의 잔여 storyId 차단).
   * navigate state 로 mode 만 넘기고, CreationPage 가 useStoryCreationFlow init 으로 변환.
   */
  const handleSelectMode = useCallback(
    (mode: StoryModeApi) => {
      setIsModeModalOpen(false)
      clearCreationProgressSnapshot()
      navigate(ROUTES.creation, { state: { mode } })
    },
    [navigate],
  )

  /** 모드 선택 모달만 닫음 — 사용자가 모드 결정을 미룬 경우 책장으로 그냥 돌아감. */
  const handleCloseModeModal = useCallback(() => {
    setIsModeModalOpen(false)
  }, [])

  const handleReadStory = useCallback(
    (story: Story) => {
      setIsLibraryOpen(false)
      const mode = story.mode === 'WEBTOON' ? 'webtoon' : 'book'
      navigate(`${buildViewerPath(story.id)}?mode=${mode}`)
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
        topRightMenu={<TopRightMenu mypageFrom="bookshelf" />}
        topBanner={
          draft ? (
            <DraftResumeBanner draft={draft} onResume={handleResumeDraft} />
          ) : null
        }
      />

      {draft && isDraftModalOpen && (
        <DraftResumeModal
          draft={draft}
          onStartNew={handleStartNew}
          onClose={handleCloseDraftModal}
          isSubmitting={isResolvingDraft}
        />
      )}

      {isModeModalOpen && (
        <StoryModeSelectModal
          onSelect={handleSelectMode}
          onClose={handleCloseModeModal}
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

      {/* (요정 / 책 등장 전환 연출은 일시 비활성화 — 추후 Lottie 로 부활 예정.
           관련 CSS(.fairy-transition*) / public assets 는 그대로 보존.) */}
    </>
  )
}
