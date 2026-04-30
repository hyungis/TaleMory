import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { Library, PlusCircle } from 'lucide-react'
import { DUMMY_STORIES, type Story } from '../../../entities/story'
import { StoryGrid } from '../story-list'
import { StoryFilter } from '../story-filter'
import { StorySort } from '../story-sort'
import { useBookshelf } from '../model/useBookshelf'
import { generateBookshelfParticles } from '../lib/generateBookshelfParticles'
import { BookshelfPagination } from './BookshelfPagination'
import '../styles/bookshelf.css'

interface BookshelfModalProps {
  isOpen: boolean
  onClose: () => void
  /** 상단 "새 동화책 만들기" 버튼. Task 4(story-creation) 에서 연결. */
  onCreateStory?: () => void
  /** 개별 카드 "읽기" 버튼. Task 9(viewer) 에서 연결. */
  onReadStory?: (story: Story) => void
  /** 개별 카드 "공유" 버튼. */
  onShareStory?: (story: Story) => void
  /** 개별 카드 "삭제" 버튼. */
  onDeleteStory?: (story: Story) => void
  /** 렌더할 책 목록. 미제공 시 DUMMY_STORIES 사용. */
  stories?: Story[]
  /** 목록 로딩 중 여부. */
  isLoading?: boolean
  /**
   * 우상단 close 버튼 옆에 추가로 띄울 메뉴 / 액션 슬롯.
   * features/bookshelf 가 외부 컴포넌트(예: pages/main 의 햄버거 메뉴) 를 직접 import 하지 않도록
   * slot 으로 받는다. 호출자가 `<TopRightMenu />` 등을 그대로 넣어주면 된다.
   */
  topRightMenu?: ReactNode
  /**
   * 타이틀 블록과 필터 바 사이에 노출되는 상단 배너 슬롯.
   * 진행 중인 동화(`<DraftResumeBanner />`) 같이 책장 바깥 도메인의 위젯을 주입하기 위함.
   * features/bookshelf 가 features/story-creation 을 직접 의존하지 않도록 slot 패턴 사용.
   */
  topBanner?: ReactNode
}

/**
 * "우리가족 책장" 모달.
 *
 * Task 3a: overlay + 테마 shell + 책 그리드 + 선반 장식
 * Task 3b: level 필터 (다중) + 정렬 (최신/오래된/가나다) + 페이지네이션 (8/page)
 *
 * 필터/정렬/페이지 상태는 `useBookshelf` 훅으로 캡슐화.
 */
export function BookshelfModal({
  isOpen,
  onClose,
  onCreateStory,
  onReadStory,
  onShareStory,
  onDeleteStory,
  stories = DUMMY_STORIES,
  isLoading = false,
  topRightMenu,
  topBanner,
}: BookshelfModalProps) {
  const { paged, filtered, activeFilters, toggleFilter, sort, updateSort, page, setPage, totalPages } =
    useBookshelf(stories)

  /**
   * 책장 배경 위로 부유하는 amber/gold 입자. 매 마운트마다 random 으로 한 번 생성하면
   * 충분 (CSS 키프레임만으로 무한 반복). 모달이 닫혔다 다시 열리면 새 좌표가 생성된다.
   */
  const particles = useMemo(() => generateBookshelfParticles(), [])

  if (!isOpen) return null

  return (
    <div className="library-modal-overlay" onClick={onClose}>
      <div className="bookshelf-modal" onClick={e => e.stopPropagation()}>
        {/* 배경 부유 입자 — amber/gold 톤 햇살 먼지. pointer-events: none 으로 모든 인터랙션 통과. */}
        <div className="bookshelf-particles" aria-hidden="true">
          {particles.map(p => (
            <span
              key={p.id}
              className="bookshelf-particle"
              style={
                {
                  left: p.left,
                  width: p.size,
                  height: p.size,
                  '--duration': p.duration,
                  '--delay': p.delay,
                  '--drift': p.drift,
                } as unknown as CSSProperties
              }
            />
          ))}
        </div>

        {/* 우상단 외부 슬롯 (햄버거 메뉴 등). close 버튼 왼쪽에 위치. */}
        {topRightMenu && (
          <div className="bookshelf-modal__top-right-slot">{topRightMenu}</div>
        )}

        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="닫기">
          ×
        </button>

        <div className="bookshelf-scroll">
          <main className="py-12 px-6 md:px-16 lg:px-32 xl:px-48 2xl:px-64 relative">
            <div className="mx-auto pb-16">
              {/* 타이틀 + 새 동화책 만들기 */}
              <div className="mb-12 flex flex-col md:flex-row justify-between items-center gap-6 bookshelf-fade-in">
                <div className="text-center md:text-left">
                  <h1 className="bookshelf-title-display text-4xl md:text-5xl text-[#3F6B2E] mb-3 flex items-center justify-center md:justify-start gap-3 font-bold">
                    우리가족 책장 <Library className="w-10 h-10 text-[#517E37]" />
                  </h1>
                  <p className="text-[#6B4A28] text-lg md:text-xl">
                    지금까지 만든 소중한 여행과 일상의 이야기들을 모아보세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCreateStory}
                  className="bg-[#8DBA64] text-[#1F3318] px-8 py-4 rounded-full border border-[#B9D38F] shadow-[0_3px_0_#3F6B2E] hover:translate-y-1 hover:shadow-[0_1px_0_#3F6B2E] hover:bg-[#A6CB45] transition-all font-bold flex items-center gap-2 text-xl whitespace-nowrap"
                >
                  <PlusCircle className="w-6 h-6" /> 새 동화책 만들기
                </button>
              </div>

              {/* 진행 중인 동화 배너 — 외부에서 주입 (story-creation/DraftResumeBanner). null/undefined 면 미렌더. */}
              {topBanner}

              {/* 필터/정렬 바 */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-4 border-b border-[#9A7548] gap-4 bookshelf-fade-in relative z-20">
                <StoryFilter
                  activeFilters={activeFilters}
                  onToggle={toggleFilter}
                  totalCount={filtered.length}
                />
                <StorySort value={sort} onChange={updateSort} />
              </div>

              {/* 책 그리드 (현재 페이지만) */}
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-10 h-10 border-4 border-[#B9D38F]/30 border-t-[#B9D38F] rounded-full animate-spin" />
                </div>
              ) : (
                <StoryGrid stories={paged} onRead={onReadStory} onShare={onShareStory} onDelete={onDeleteStory} />
              )}

              {/* 페이지네이션 (1페이지 초과시만) */}
              {totalPages > 1 && (
                <BookshelfPagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
