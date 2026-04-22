import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize, X } from 'lucide-react'
import type { StoryView } from '../../model/types'
import { BookCover } from './BookCover'
import { BookSpread } from './BookSpread'
import { BookBackCover } from './BookBackCover'
import { TurnSheet } from './TurnSheet'
import { ViewerToolbar } from './ViewerToolbar'
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

interface FlipState {
  direction: 'next' | 'prev'
  fromPageIndex: number
  toPageIndex: number
}

const FLIP_DURATION_MS = 850
const FADE_DURATION_MS = 600
const TOOLBAR_CLOSE_DELAY_MS = 350

/**
 * 동화책 모드 메인 뷰어.
 * 페이지 구성: [앞표지] → scene 1..N → [뒷표지(편지지)]
 *
 * scene↔scene 전환은 반쪽 종이 3D 플립 애니메이션, cover/backCover 가 끼어있으면
 * 표지 단면이라 플립이 부자연스러워 opacity 페이드 fallback.
 *
 * 좌측 가장자리 호버 시 사이드 툴바(TTS / 번역 / 폰트 크기)가 슬라이드 인.
 */
export function StoryBookViewer({ story, onExit }: StoryBookViewerProps) {
  const pages: ViewerPage[] = [
    { kind: 'cover' },
    ...story.scenes.map((_, i) => ({ kind: 'scene' as const, sceneIndex: i })),
    { kind: 'backCover' },
  ]

  const [pageIndex, setPageIndex] = useState(0)
  const [flip, setFlip] = useState<FlipState | null>(null)
  const [isFading, setIsFading] = useState(false)
  const swapTimerRef = useRef<number | null>(null)

  // 툴바 / 보기 설정 상태
  const [isToolbarOpen, setIsToolbarOpen] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [fontSize, setFontSize] = useState(22)
  const toolbarCloseTimerRef = useRef<number | null>(null)

  const isBusy = flip !== null || isFading

  const goTo = (target: number) => {
    if (isBusy) return
    if (target < 0 || target >= pages.length) return

    const from = pages[pageIndex]
    const to = pages[target]
    const direction: 'next' | 'prev' = target > pageIndex ? 'next' : 'prev'
    const sceneToScene = from.kind === 'scene' && to.kind === 'scene'

    if (!sceneToScene) {
      setIsFading(true)
      window.setTimeout(() => {
        setPageIndex(target)
        window.setTimeout(() => setIsFading(false), FADE_DURATION_MS / 2)
      }, FADE_DURATION_MS / 2)
      return
    }

    setFlip({ direction, fromPageIndex: pageIndex, toPageIndex: target })
    swapTimerRef.current = window.setTimeout(() => {
      setPageIndex(target)
    }, FLIP_DURATION_MS / 2)
  }

  useEffect(() => {
    return () => {
      if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current)
      if (toolbarCloseTimerRef.current !== null) window.clearTimeout(toolbarCloseTimerRef.current)
    }
  }, [])

  const handleFlipEnd = () => {
    setFlip(null)
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

  const openToolbar = () => {
    if (toolbarCloseTimerRef.current !== null) {
      window.clearTimeout(toolbarCloseTimerRef.current)
      toolbarCloseTimerRef.current = null
    }
    setIsToolbarOpen(true)
  }
  const scheduleToolbarClose = () => {
    toolbarCloseTimerRef.current = window.setTimeout(() => {
      setIsToolbarOpen(false)
    }, TOOLBAR_CLOSE_DELAY_MS)
  }

  const current = pages[pageIndex]
  const isCover = current.kind === 'cover'
  const isBackCover = current.kind === 'backCover'
  const shellClass = `sb-shell ${isCover ? 'is-cover' : ''} ${isBackCover ? 'is-back-cover' : ''}`.trim()

  const flipFromScene = flip && pages[flip.fromPageIndex].kind === 'scene'
    ? story.scenes[pages[flip.fromPageIndex].sceneIndex!]
    : null
  const flipToScene = flip && pages[flip.toPageIndex].kind === 'scene'
    ? story.scenes[pages[flip.toPageIndex].sceneIndex!]
    : null

  const toolbarScene = current.kind === 'scene' && current.sceneIndex !== undefined
    ? story.scenes[current.sceneIndex]
    : null

  return (
    <div className="sb-room">
      {/* 좌측 호버 트리거 */}
      <div
        className="sb-side-trigger"
        onMouseEnter={openToolbar}
        onMouseLeave={scheduleToolbarClose}
        aria-hidden
      />

      {/* 사이드 툴바 */}
      <ViewerToolbar
        isOpen={isToolbarOpen}
        currentScene={toolbarScene}
        showTranslation={showTranslation}
        fontSize={fontSize}
        onTranslationToggle={() => setShowTranslation(v => !v)}
        onFontSizeChange={setFontSize}
        onMouseEnter={openToolbar}
        onMouseLeave={scheduleToolbarClose}
      />

      <div className="sb-float-top">
        <button onClick={toggleFullscreen} className="sb-float-btn" title="전체화면" aria-label="전체화면 토글">
          <Maximize className="w-5 h-5" />
        </button>
        <button onClick={onExit} className="sb-float-btn" title="닫기" aria-label="뷰어 닫기">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className={shellClass}>
        <div
          className="sb-spread"
          style={{
            opacity: isFading ? 0.35 : 1,
            transition: `opacity ${FADE_DURATION_MS}ms ease, border-radius ${FADE_DURATION_MS}ms ease, box-shadow ${FADE_DURATION_MS}ms ease`,
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
              showTranslation={showTranslation}
              fontSize={fontSize}
            />
          )}

          {current.kind === 'backCover' && (
            <BookBackCover outro={story.outro} onRestart={() => goTo(0)} />
          )}
        </div>

        {flip && flipFromScene && flipToScene && (
          <TurnSheet
            direction={flip.direction}
            fromScene={flipFromScene}
            fromIndex={pages[flip.fromPageIndex].sceneIndex!}
            toScene={flipToScene}
            toIndex={pages[flip.toPageIndex].sceneIndex!}
            onEnd={handleFlipEnd}
          />
        )}

        <button
          className="sb-nav-arrow prev"
          onClick={prev}
          disabled={pageIndex === 0 || isBusy}
          title="이전 페이지"
          aria-label="이전 페이지"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <button
          className="sb-nav-arrow next"
          onClick={next}
          disabled={pageIndex === pages.length - 1 || isBusy}
          title="다음 페이지"
          aria-label="다음 페이지"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      </div>
    </div>
  )
}
