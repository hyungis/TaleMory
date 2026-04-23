import { useCallback, useState } from 'react'
import { ArrowLeft, Library } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { LogoutButton } from '../../../features/auth'
import { BookshelfModal } from '../../../features/bookshelf'
import type { Story } from '../../../entities/story'
import { ROUTES, buildViewerPath } from '../../../shared/constants'

interface BookstoreSceneProps {
  onBackToForest: () => void
}

export function BookstoreScene({ onBackToForest }: BookstoreSceneProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const navigate = useNavigate()

  const handleOpenLibrary = useCallback(() => {
    setIsLibraryOpen(true)
  }, [])

  const handleCloseLibrary = useCallback(() => {
    setIsLibraryOpen(false)
  }, [])

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
        <ArrowLeft className="icon" aria-hidden />
      </button>

      <div className="bookstore-action-buttons">
        <button type="button" className="bookstore-action-btn open-library-btn" onClick={handleOpenLibrary}>
          <Library className="icon" aria-hidden />
          <span>우리 가족 책장</span>
        </button>
        <LogoutButton />
      </div>

      <img src="/bookstore.png" alt="서점 배경" className="bookstore-bg" draggable={false} />

      <BookshelfModal
        isOpen={isLibraryOpen}
        onClose={handleCloseLibrary}
        onCreateStory={handleCreateStory}
        onReadStory={handleReadStory}
      />
    </>
  )
}
