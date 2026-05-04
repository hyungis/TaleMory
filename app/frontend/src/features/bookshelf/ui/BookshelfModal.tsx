import { type ReactNode } from 'react'
import { PlusCircle } from 'lucide-react'
import { type Story } from '../../../entities/story'
import { StoryGrid } from '../story-list'
import { StoryFilter } from '../story-filter'
import { StorySort } from '../story-sort'
import { useBookshelf } from '../model/useBookshelf'
import { BookshelfPagination } from './BookshelfPagination'
import { BookshelfDoodles } from './BookshelfDoodles'
import { EmptyBookshelfState } from './EmptyBookshelfState'
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
  /** 렌더할 책 목록. 미제공 시 빈 배열. */
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
  stories = [],
  isLoading = false,
  topRightMenu,
  topBanner,
}: BookshelfModalProps) {
  const { paged, filtered, activeFilters, toggleFilter, sort, updateSort, page, setPage, totalPages } =
    useBookshelf(stories)

  if (!isOpen) return null

  return (
    <div className="library-modal-overlay" onClick={onClose}>
      <div className="bookshelf-modal" onClick={e => e.stopPropagation()}>
        {/* 햄버거 / 닫기 버튼은 .top-actions 안 인라인 으로 이동 — Claude .topbar 와 동일 배치.
            (이전 absolute 슬롯 / 우상단 close 버튼 모두 제거.) */}

        {/* 종이 텍스처 + 손그림 데코 — 모든 콘텐츠 뒤. .bookshelf-scroll 외부에 배치해 화면 스크롤과 무관하게 고정. */}
        <div className="bookshelf-bg-grain" aria-hidden="true" />
        <div className="bookshelf-bg-crayon" aria-hidden="true" />
        <BookshelfDoodles />

        <div className="bookshelf-scroll">
          <main className="relative" style={{ padding: '56px 56px 120px' }}>
            <div className="mx-auto relative" style={{ maxWidth: 1200, zIndex: 2 }}>
              {/* 타이틀 + 새 동화책 만들기 + icon 버튼들 — Claude .topbar 그대로.
                  position:relative + 높은 z-index — 햄버거 panel(z:60) 이 그 아래 banner 위로 떠오르도록. */}
              <div className="bookshelf-fade-in flex items-start justify-between gap-6 relative" style={{ marginBottom: 36, zIndex: 30 }}>
                <div>
                  <h1
                    className="m-0 inline-flex items-center"
                    style={{
                      fontFamily: 'var(--font-display)',  // Gaegu — Pen Script 보다 두꺼움
                      fontWeight: 700,
                      fontSize: 64,
                      color: '#5f7d50',
                      letterSpacing: '0.5px',
                      lineHeight: 1,
                      gap: 14,
                      textShadow: '1px 1px 0 rgba(255,255,255,0.5), 0 0 1px rgba(95,125,80,0.3)',
                      // 살짝 더 굵어 보이도록 미세한 stroke 추가
                      WebkitTextStroke: '0.5px #5f7d50',
                    }}
                  >
                    우리가족 책장
                    <span style={{ color: '#a37548', fontSize: 48, transform: 'translateY(-4px)' }}>
                      ⫻
                    </span>
                  </h1>
                  {/* 빨간 손그림 밑줄 — SVG wavy path */}
                  <svg
                    viewBox="0 0 240 8"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    style={{ display: 'block', marginTop: 4, width: 240, height: 8 }}
                  >
                    <path
                      d="M2,5 Q40,1 80,4 T160,4 T238,3"
                      stroke="#c47254"
                      strokeWidth="2.2"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 22,
                      color: '#6b5638',
                      marginTop: 6,
                      marginLeft: 4,
                    }}
                  >
                    지금까지 만든 소중한 여행과 일상의 이야기들을 모아보세요.
                  </div>
                </div>

                {/* 우상단 액션 묶음 — primary CTA + 햄버거 + 닫기 (Claude .top-actions 1:1). */}
                <div className="flex items-center" style={{ marginTop: 8, gap: 12 }}>
                  <button
                    type="button"
                    onClick={onCreateStory}
                    className="inline-flex items-center"
                    style={{
                      background: '#7a9968',
                      color: '#fdfaf0',
                      border: '2px solid #5f7d50',
                      padding: '14px 26px',
                      borderRadius: 999,
                      fontFamily: 'var(--font-display)',
                      fontSize: 22,
                      fontWeight: 700,
                      cursor: 'pointer',
                      gap: 8,
                      boxShadow: '0 3px 0 #5f7d50, 0 6px 14px rgba(95, 125, 80, 0.25)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    <PlusCircle className="w-5 h-5" strokeWidth={2.2} />
                    새 동화책 만들기
                  </button>

                  {/* 햄버거 메뉴 — TopRightMenu 외부 컴포넌트.
                      `.top-right-menu__trigger` CSS 가 main.css 에서 .icon-btn 톤으로 매칭됨. */}
                  {topRightMenu}

                  {/* 닫기 — Claude .icon-btn.close (caramel-deep border + cream bg). */}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="닫기"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      border: '2px solid #a37548',
                      background: '#fcf3df',
                      color: '#a37548',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 0 rgba(74,59,42,0.2)',
                      transition: 'transform 0.2s ease, background 0.2s ease',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M3,3 L13,13 M13,3 L3,13"
                        stroke="#a37548"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 진행 중인 동화 배너 — 외부에서 주입. */}
              {topBanner}

              {/* 필터/정렬 바 + 손그림 wavy 구분선 */}
              <div
                className="flex items-center justify-between gap-4 bookshelf-fade-in relative"
                style={{ marginBottom: 8, paddingBottom: 14, zIndex: 3 }}
              >
                <StoryFilter
                  activeFilters={activeFilters}
                  onToggle={toggleFilter}
                  totalCount={filtered.length}
                />
                <StorySort value={sort} onChange={updateSort} />
              </div>
              <div className="bookshelf-divider" style={{ marginBottom: 24 }} aria-hidden="true" />

              {/* 책 그리드 또는 빈 상태 */}
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-10 h-10 border-4 border-[#7a9968]/30 border-t-[#7a9968] rounded-full animate-spin" />
                </div>
              ) : paged.length === 0 ? (
                <EmptyBookshelfState />
              ) : (
                <StoryGrid stories={paged} onRead={onReadStory} onShare={onShareStory} onDelete={onDeleteStory} />
              )}

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <BookshelfPagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              )}

              {/* footer signature — made with ♥ for our family */}
              <div
                className="text-center"
                style={{
                  marginTop: 70,
                  fontFamily: 'var(--font-display-pen)',
                  fontSize: 22,
                  color: '#8a7558',
                  opacity: 0.7,
                }}
              >
                — made with <span style={{ color: '#c47254' }}>♥</span> for our family —
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
