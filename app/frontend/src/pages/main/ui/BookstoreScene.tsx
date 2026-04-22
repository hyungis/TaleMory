import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookshelfModal } from '../../../features/bookshelf'
import type { Story } from '../../../entities/story'
import { ROUTES, buildViewerPath } from '../../../shared/constants'

interface BookstoreSceneProps {
  onBackToForest: () => void
}

/**
 * 서점(Bookstore) 씬.
 *
 * - `/bookstore.png` 배경 (bookstoreEntry 키프레임으로 scale-in)
 * - 좌상단: 숲으로 돌아가기 버튼
 * - 우상단: "우리 가족 책장" 버튼 → `BookshelfModal` 오픈
 * - (TODO Task 4~8) 스토리 제작 steps-container
 */
export function BookstoreScene({ onBackToForest }: BookstoreSceneProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)

  const handleOpenLibrary = useCallback(() => {
    setIsLibraryOpen(true)
  }, [])

  const handleCloseLibrary = useCallback(() => {
    setIsLibraryOpen(false)
  }, [])

  const navigate = useNavigate()

  const handleCreateStory = useCallback(() => {
    setIsLibraryOpen(false)
    navigate(ROUTES.creation)
  }, [navigate])

  const handleReadStory = useCallback(
    (story: Story) => {
      setIsLibraryOpen(false)
      navigate(buildViewerPath(story.id))
    },
    [navigate],
  )

  return (
    <>
      <button type="button" className="back-to-forest-btn" onClick={onBackToForest}>
        <span className="icon">←</span>
      </button>

      <button type="button" className="open-library-btn" onClick={handleOpenLibrary}>
        <span className="icon">📚</span>
        <span>우리 가족 책장</span>
      </button>

      <img src="/bookstore.png" alt="서점 내부" className="bookstore-bg" draggable={false} />

      {/* TODO(S14P31S210-76, Task 4~8): steps-container (STEP 0: 책장 대시보드, STEP 1~5: 제작 플로우) */}

      <BookshelfModal
        isOpen={isLibraryOpen}
        onClose={handleCloseLibrary}
        onCreateStory={handleCreateStory}
        onReadStory={handleReadStory}
      />
    </>
  )
}
