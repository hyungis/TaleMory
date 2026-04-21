import { useCallback, useState } from 'react'

interface BookstoreSceneProps {
  onBackToForest: () => void
}

/**
 * 서점(Bookstore) 씬.
 *
 * - `/bookstore.png` 배경 (bookstoreEntry 키프레임으로 scale-in)
 * - 숲으로 돌아가기 버튼 (좌상단)
 * - "우리 가족 책장" 버튼 (우상단) → 책장 모달 (Task 3 에서 구현)
 * - 스토리 제작 steps-container (Task 4~8 에서 구현)
 */
export function BookstoreScene({ onBackToForest }: BookstoreSceneProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)

  const handleOpenLibrary = useCallback(() => {
    // TODO(S14P31S210-76, Task 3): Bookshelf 모달 연결
    setIsLibraryOpen(true)
  }, [])

  const handleCloseLibrary = useCallback(() => {
    setIsLibraryOpen(false)
  }, [])

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

      {/* TODO(S14P31S210-76, Task 3~8): steps-container (STEP 0: 책장 대시보드, STEP 1~5: 제작 플로우) */}

      {isLibraryOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
          onClick={handleCloseLibrary}
        >
          <div
            className="bg-[#2a1b12] border-2 border-[#b4dc8c] rounded-2xl p-8 max-w-md text-[#f0e6c0] text-center"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-3 text-[#b4dc8c]">우리 가족 책장</h2>
            <p className="text-sm text-[#b4c4a4] mb-6">
              Task 3 에서 실제 책장 목록 / 필터 / 정렬 / 북마크 UI 로 교체 예정입니다.
            </p>
            <button
              type="button"
              onClick={handleCloseLibrary}
              className="bg-[#2d5a27] text-[#f0e6c0] px-6 py-2 rounded-full border border-[#b4dc8c]/40 font-bold hover:bg-[#3d6f34] transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
