import { useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, ChevronLeft, ChevronRight, Maximize, X } from 'lucide-react'
import type { StoryView, SceneView, WordEntry } from '../../model/types'
import { BookCover } from './BookCover'
import { BookSpread } from './BookSpread'
import { BookBackCover } from './BookBackCover'
import { TurnSheet } from './TurnSheet'
import { ViewerToolbar, type ViewerTheme } from './ViewerToolbar'
import { IllustrationModal } from './IllustrationModal'
import { WordLookupCard } from './WordLookupCard'
import { useStoryTts } from '../model/useStoryTts'
import { getWordMeaning } from '../../api'
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

const STORAGE_KEY_THEME = 'viewer-theme'
const storageKeyBookmark = (storyId: number) => `viewer-bookmark-${storyId}`

const VALID_THEMES: ViewerTheme[] = ['forest', 'sunset', 'night']

/**
 * 동화책 모드 메인 뷰어.
 * 페이지 구성: [앞표지] → scene 1..N → [뒷표지(편지지)]
 *
 * scene↔scene 전환은 반쪽 종이 3D 플립 애니메이션, cover/backCover 가 끼어있으면
 * 표지 단면이라 플립이 부자연스러워 opacity 페이드 fallback.
 *
 * TTS 는 `useStoryTts` 훅이 소유 — inline 페이지 재생 / 문장 클릭 / 전체 책 자동 읽기 모두 지원.
 * 좌측 가장자리 호버 시 사이드 툴바(TTS / 번역 / 폰트 / 책갈피 / 테마)가 슬라이드 인.
 *
 * 책갈피·테마는 로그인 인프라 미완성이라 localStorage 에 저장. 추후 `/progress` API 연동 시
 * 별도 어댑터로 교체 가능.
 */
export function StoryBookViewer({ story, onExit }: StoryBookViewerProps) {
  const pages: ViewerPage[] = useMemo(
    () => [
      { kind: 'cover' as const },
      ...story.scenes.map((_, i) => ({ kind: 'scene' as const, sceneIndex: i })),
      { kind: 'backCover' as const },
    ],
    [story.scenes],
  )

  const [pageIndex, setPageIndex] = useState(0)
  const [flip, setFlip] = useState<FlipState | null>(null)
  const [isFading, setIsFading] = useState(false)
  const swapTimerRef = useRef<number | null>(null)

  // 툴바 / 보기 설정 상태
  const [isToolbarOpen, setIsToolbarOpen] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [fontSize, setFontSize] = useState(22)
  const toolbarCloseTimerRef = useRef<number | null>(null)

  // 삽화 확대 모달
  const [zoomedScene, setZoomedScene] = useState<SceneView | null>(null)

  // 단어 번역 팝업
  const [wordLookup, setWordLookup] = useState<{ word: string; entries: WordEntry[]; isLoading: boolean } | null>(null)

  // 책갈피 — 한 동화당 1개 (pageIndex 단일값)
  const [bookmark, setBookmark] = useState<number | null>(null)

  // 테마
  const [theme, setTheme] = useState<ViewerTheme>('forest')

  // TTS
  const tts = useStoryTts()

  // ===== localStorage 초기 로드 =====
  useEffect(() => {
    try {
      const rawTheme = window.localStorage.getItem(STORAGE_KEY_THEME)
      if (rawTheme && VALID_THEMES.includes(rawTheme as ViewerTheme)) {
        setTheme(rawTheme as ViewerTheme)
      }
    } catch {
      /* noop */
    }
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKeyBookmark(story.storyId))
      if (raw) {
        const parsed = JSON.parse(raw)
        if (typeof parsed === 'number' && Number.isFinite(parsed)) {
          setBookmark(parsed)
        }
      }
    } catch {
      /* noop */
    }
  }, [story.storyId])

  // ===== localStorage 저장 =====
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_THEME, theme)
    } catch {
      /* noop */
    }
  }, [theme])

  useEffect(() => {
    try {
      const key = storageKeyBookmark(story.storyId)
      if (bookmark === null) {
        window.localStorage.removeItem(key)
      } else {
        window.localStorage.setItem(key, JSON.stringify(bookmark))
      }
    } catch {
      /* noop */
    }
  }, [bookmark, story.storyId])

  const isBusy = flip !== null || isFading

  const goTo = (target: number) => {
    if (isBusy) return
    if (target < 0 || target >= pages.length) return

    tts.stop()

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
  const roomClass = `sb-room sb-theme-${theme}`

  const flipFromScene = flip && pages[flip.fromPageIndex].kind === 'scene'
    ? story.scenes[pages[flip.fromPageIndex].sceneIndex!]
    : null
  const flipToScene = flip && pages[flip.toPageIndex].kind === 'scene'
    ? story.scenes[pages[flip.toPageIndex].sceneIndex!]
    : null

  // 전체 책 자동 재생
  const playFullBook = () => {
    const startSceneIndex = current.kind === 'scene' && current.sceneIndex !== undefined
      ? current.sceneIndex
      : 0
    const targetPageIndex = startSceneIndex + 1

    const startPlayback = () => {
      tts.speakFullBook(story.scenes, startSceneIndex, sceneIdx => {
        setPageIndex(sceneIdx + 1)
      })
    }

    if (pageIndex === targetPageIndex) {
      startPlayback()
    } else {
      setIsFading(true)
      window.setTimeout(() => {
        setPageIndex(targetPageIndex)
        window.setTimeout(() => {
          setIsFading(false)
          startPlayback()
        }, FADE_DURATION_MS / 2)
      }, FADE_DURATION_MS / 2)
    }
  }

  // 책갈피 핸들러 (한 동화당 1개)
  const canBookmarkCurrent = current.kind === 'scene'
  const isCurrentBookmarked = canBookmarkCurrent && bookmark === pageIndex

  const toggleBookmark = () => {
    if (!canBookmarkCurrent) return
    setBookmark(prev => (prev === pageIndex ? null : pageIndex))
  }

  const jumpToBookmark = () => {
    if (bookmark === null || bookmark === pageIndex) return
    goTo(bookmark)
  }

  // 단어 번역 조회
  const handleWordClick = (word: string) => {
    const clean = word.trim()
    if (!clean) return
    setWordLookup({ word: clean, entries: [], isLoading: true })
    getWordMeaning(clean)
      .then(entries => {
        setWordLookup(prev => (prev && prev.word === clean ? { word: clean, entries, isLoading: false } : prev))
      })
      .catch(() => {
        setWordLookup(prev => (prev && prev.word === clean ? { word: clean, entries: [], isLoading: false } : prev))
      })
  }

  // 툴바에 넘길 책갈피 표시 라벨 ("Page N") — 유효한 scene 을 가리킬 때만
  const bookmarkLabel = useMemo(() => {
    if (bookmark === null) return null
    if (bookmark < 0 || bookmark >= pages.length) return null
    const page = pages[bookmark]
    if (page.kind !== 'scene' || page.sceneIndex === undefined) return null
    return `Page ${page.sceneIndex + 1}`
  }, [bookmark, pages])
  const canJumpToBookmark = bookmark !== null && bookmark !== pageIndex

  return (
    <div className={roomClass}>
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
        ttsMode={tts.status.mode}
        showTranslation={showTranslation}
        fontSize={fontSize}
        canBookmark={canBookmarkCurrent}
        isBookmarked={isCurrentBookmarked}
        bookmarkLabel={bookmarkLabel}
        canJumpToBookmark={canJumpToBookmark}
        theme={theme}
        onPlayFullBook={playFullBook}
        onPause={tts.pause}
        onResume={tts.resume}
        onStop={tts.stop}
        onTranslationToggle={() => setShowTranslation(v => !v)}
        onFontSizeChange={setFontSize}
        onToggleBookmark={toggleBookmark}
        onJumpToBookmark={jumpToBookmark}
        onThemeChange={setTheme}
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

          {/* 책갈피 플래그 — 현재 페이지가 책갈피된 scene 인 경우 */}
          {isCurrentBookmarked && (
            <div className="sb-bookmark-flag" aria-label="책갈피된 페이지">
              <Bookmark className="w-3 h-3" />
            </div>
          )}

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
              activeSentenceId={tts.status.activeSentenceId}
              onSentenceClick={(sc, sent) => tts.speakSentence(sc, sent)}
              onWordClick={handleWordClick}
              onPlayPage={sc => tts.speakPage(sc)}
              onIllustrationClick={setZoomedScene}
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

      <IllustrationModal scene={zoomedScene} onClose={() => setZoomedScene(null)} />

      {wordLookup && (
        <WordLookupCard
          word={wordLookup.word}
          entries={wordLookup.entries}
          isLoading={wordLookup.isLoading}
          onClose={() => setWordLookup(null)}
        />
      )}
    </div>
  )
}
