import { Library, PlusCircle } from 'lucide-react'
import { DUMMY_STORIES, type Story } from '../../../entities/story'
import { StoryGrid } from '../story-list'
import '../styles/bookshelf.css'

interface BookshelfModalProps {
  isOpen: boolean
  onClose: () => void
  /** 상단 "새 동화책 만들기" 버튼. Task 4(story-creation) 에서 연결. */
  onCreateStory?: () => void
  /** 개별 카드 "읽기" 버튼. Task 9(viewer) 에서 연결. */
  onReadStory?: (story: Story) => void
  /** 렌더할 책 목록. 미제공 시 DUMMY_STORIES 사용. */
  stories?: Story[]
}

/**
 * "우리가족 책장" 모달.
 *
 * 현재 (Task 3a) 범위:
 *  - Forest Library 테마 overlay + 모달 껍데기
 *  - 타이틀 + 새 동화책 만들기 버튼 (stub)
 *  - 책 그리드 + 각 row 마다 나무 선반 장식
 *  - 읽기/공유/삭제 버튼은 props 콜백만 호출 (아직 실제 동작 없음)
 *
 * Task 3b 에서 필터/정렬/페이지네이션 추가.
 */
export function BookshelfModal({
  isOpen,
  onClose,
  onCreateStory,
  onReadStory,
  stories = DUMMY_STORIES,
}: BookshelfModalProps) {
  if (!isOpen) return null

  return (
    <div className="library-modal-overlay" onClick={onClose}>
      <div className="bookshelf-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="닫기">
          ×
        </button>

        <div className="bookshelf-scroll">
          <main className="py-12 px-6 md:px-12 relative">
            <div className="max-w-6xl mx-auto pb-16">
              {/* 타이틀 + 새 동화책 만들기 */}
              <div className="mb-12 flex flex-col md:flex-row justify-between items-center gap-6 bookshelf-fade-in">
                <div className="text-center md:text-left">
                  <h1 className="bookshelf-title-display text-4xl md:text-5xl text-[#f0e6c0] mb-3 flex items-center justify-center md:justify-start gap-3 font-bold">
                    우리가족 책장 <Library className="w-10 h-10 text-[#b4dc8c]" />
                  </h1>
                  <p className="text-[#b4c4a4] text-lg md:text-xl">
                    지금까지 만든 소중한 여행과 일상의 이야기들을 모아보세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCreateStory}
                  className="bg-[#2d5a27] text-[#f0e6c0] px-8 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.2)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.4)] hover:bg-[#3d6f34] transition-all font-bold flex items-center gap-2 text-xl whitespace-nowrap"
                >
                  <PlusCircle className="w-6 h-6" /> 새 동화책 만들기
                </button>
              </div>

              {/* TODO(S14P31S210-76, Task 3b): 필터/정렬 바 (초급/중급/고급 + 최신순/오래된순/가나다순) */}

              {/* 책 그리드 */}
              <StoryGrid stories={stories} onRead={onReadStory} />

              {/* TODO(S14P31S210-76, Task 3b): 페이지네이션 (ITEMS_PER_PAGE=8 기준) */}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
