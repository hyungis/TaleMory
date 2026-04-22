import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize } from 'lucide-react'
import type { StoryView } from '../../model/types'
import { BookCover } from './BookCover'
import { BookSpread } from './BookSpread'
import { BookBackCover } from './BookBackCover'
import '../styles/story-book.css'

interface StoryBookViewerProps {
  story: StoryView
  onExit: () => void
}

type PageKind = 'cover' | 'scene' | 'backCover'

interface ViewerPage {
  kind: PageKind
  sceneIndex?: number
}

/**
 * 동화책 모드 메인 뷰어.
 * 페이지 구성: [앞표지] → scene 1..N → [뒷표지(편지지)]
 */
export function StoryBookViewer({ story, onExit }: StoryBookViewerProps) {
  const pages: ViewerPage[] = [
    { kind: 'cover' },
    ...story.scenes.map((_, i) => ({ kind: 'scene' as const, sceneIndex: i })),
    { kind: 'backCover' },
  ]

  const [pageIndex, setPageIndex] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)

  const goTo = (target: number) => {
    if (isFlipping) return
    if (target < 0 || target >= pages.length) return
    setIsFlipping(true)
    window.setTimeout(() => {
      setPageIndex(target)
      window.setTimeout(() => setIsFlipping(false), 320)
    }, 300)
  }

  const prev = () => goTo(pageIndex - 1)
  const next = () => goTo(pageIndex + 1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen()
    }
  }

  const current = pages[pageIndex]
  const isCover = current.kind === 'cover'
  const isBackCover = current.kind === 'backCover'
  const shellClass = `sb-shell ${isCover ? 'is-cover' : ''} ${isBackCover ? 'is-back-cover' : ''}`.trim()

  return (
    <div className="sb-room">
      {/* 우측 상단 부유 버튼 */}
      <div className="sb-float-top">
        <button onClick={toggleFullscreen} className="sb-float-btn" title="전체화면" aria-label="전체화면 토글">
          <Maximize className="w-5 h-5" />
        </button>
        <button onClick={onExit} className="sb-float-btn" title="닫기" aria-label="뷰어 닫기">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <div className={shellClass}>
        <div
          className="sb-spread"
          style={{
            opacity: isFlipping ? 0.35 : 1,
            transition: 'opacity 600ms ease, border-radius 600ms ease, box-shadow 600ms ease',
          }}
        >
          {(isCover || isBackCover) && <div className="sb-spine" />}

          {current.kind === 'cover' && (
            <BookCover
              title={story.title ?? '제목 없는 동화'}
              subtitle="TaleMory"
              authorLabel={story.mainCharacter?.name ? `${story.mainCharacter.name}의 가족 드림` : '우리 가족 드림'}
              illustrationUrl={story.coverIllustrationUrl}
            />
          )}

          {current.kind === 'scene' && current.sceneIndex !== undefined && (
            <BookSpread
              scene={story.scenes[current.sceneIndex]}
              pageIndex={current.sceneIndex}
              showTranslation={false}
            />
          )}

          {current.kind === 'backCover' && (
            <BookBackCover outro={story.outro} onRestart={() => goTo(0)} />
          )}
        </div>

        <button
          className="sb-nav-arrow prev"
          onClick={prev}
          disabled={pageIndex === 0 || isFlipping}
          title="이전 페이지"
          aria-label="이전 페이지"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <button
          className="sb-nav-arrow next"
          onClick={next}
          disabled={pageIndex === pages.length - 1 || isFlipping}
          title="다음 페이지"
          aria-label="다음 페이지"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      </div>
    </div>
  )
}
