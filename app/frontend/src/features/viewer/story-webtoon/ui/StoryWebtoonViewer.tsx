import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StoryView, SentenceView } from '../../model/types'
import type { WordEntry } from '../../model/types'
import { useWebtoonAudio } from '../model/useWebtoonAudio'
import { WebtoonPageView } from './WebtoonPageView'
import { BookCover } from '../../story-book/ui/BookCover'
import { BookBackCover } from '../../story-book/ui/BookBackCover'
import { WordLookupCard } from '../../story-book/ui/WordLookupCard'
import { getWordMeaning } from '../../api'
import '../../story-book/styles/story-book.css'
import '../styles/story-webtoon.css'

interface Token { kind: 'word' | 'nonword'; text: string }

function tokenize(text: string): Token[] {
  const pattern = /[a-zA-Z]+(?:'[a-zA-Z]+)?|[^a-zA-Z]+/g
  const out: Token[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) {
    const isWord = /^[a-zA-Z]/.test(m[0])
    out.push({ kind: isWord ? 'word' : 'nonword', text: m[0] })
  }
  return out
}

interface StoryWebtoonViewerProps {
  story: StoryView
  isOwner: boolean
  onExit: () => void
}

function isNarration(sentence: SentenceView): boolean {
  return !sentence.speakerKey || sentence.speakerKey === 'narrator' || sentence.speakerKey === 'narration'
}

export function StoryWebtoonViewer({ story, isOwner, onExit }: StoryWebtoonViewerProps) {
  const audio = useWebtoonAudio()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [panelTab, setPanelTab] = useState<'korean' | 'english'>('korean')
  const [currentPage, setCurrentPage] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const isAutoPlayingRef = useRef(false)
  isAutoPlayingRef.current = isAutoPlaying

  const title = story.title?.trim() || '제목 없는 동화'
  const contentScenes = useMemo(
    () => story.scenes.filter(s => s.pageNumber > 0),
    [story.scenes],
  )
  const hasOutro = !!story.outro
  const [outroReached, setOutroReached] = useState(false)
  // page 0 = 표지, page 1..N = 본문, page N+1 = 아웃트로
  const totalPages = 1 + contentScenes.length + (hasOutro ? 1 : 0)
  const currentScene = currentPage >= 1 && currentPage <= contentScenes.length ? contentScenes[currentPage - 1] : null
  const isPlayingCurrentPage = !isAutoPlaying && audio.isPlaying && currentScene != null && audio.activeSceneId === currentScene.sceneId
  const [wordLookup, setWordLookup] = useState<{ word: string; entries: WordEntry[]; isLoading: boolean } | null>(null)

  const handleWordClick = useCallback((word: string) => {
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
  }, [])

  const togglePagePlay = () => {
    if (currentScene) audio.playPage(currentScene)
  }

  // --- 현재 보이는 페이지 감지 ---
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      entries => {
        let best: IntersectionObserverEntry | null = null
        for (const entry of entries) {
          if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
            best = entry
          }
        }
        if (best) {
          const index = Number(best.target.getAttribute('data-page-index'))
          if (!Number.isNaN(index)) {
              setCurrentPage(prev => {
                if (prev !== index) audio.stop()
                return index
              })
              if (hasOutro && index === contentScenes.length + 1) setOutroReached(true)
            }
        }
      },
      { root: container, threshold: 0.5 },
    )

    const pages = container.querySelectorAll('[data-page-index]')
    pages.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [contentScenes.length, hasOutro])

  const scrollToPage = useCallback((index: number) => {
    const container = scrollRef.current
    if (!container) return
    const target = container.querySelector(`[data-page-index="${index}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // --- 한번에 읽기 자동 재생 ---
  const runAutoPlay = useCallback(
    async (startPage: number) => {
      // startPage 가 표지(0)면 1(첫 본문)부터 시작
      const firstContent = Math.max(startPage, 1)
      for (let page = firstContent; page <= contentScenes.length; page++) {
        if (!isAutoPlayingRef.current) break
        scrollToPage(page)
        await new Promise(r => setTimeout(r, 600))
        if (!isAutoPlayingRef.current) break
        await audio.playPageAsync(contentScenes[page - 1])
      }

      if (isAutoPlayingRef.current && hasOutro) {
        scrollToPage(contentScenes.length + 1)
        await new Promise(r => setTimeout(r, 600))
        setOutroReached(true)
      }

      setIsAutoPlaying(false)
    },
    [contentScenes, hasOutro, story.outro, scrollToPage, audio],
  )

  useEffect(() => {
    if (isAutoPlaying) runAutoPlay(currentPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoPlaying])

  useEffect(() => {
    const container = scrollRef.current
    if (!container || !isAutoPlaying) return

    const stopAll = () => {
      setIsAutoPlaying(false)
      audio.stop()
    }

    container.addEventListener('wheel', stopAll, { passive: true })
    container.addEventListener('touchmove', stopAll, { passive: true })
    return () => {
      container.removeEventListener('wheel', stopAll)
      container.removeEventListener('touchmove', stopAll)
    }
  }, [isAutoPlaying, audio])

  const toggleAutoPlay = () => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false)
      audio.stop()
    } else {
      const startPage = currentPage >= totalPages - 1 ? 0 : currentPage
      if (startPage === 0) scrollToPage(0)
      setOutroReached(false)
      setIsAutoPlaying(true)
    }
  }

  const handleExit = () => {
    audio.stop()
    setIsAutoPlaying(false)
    onExit()
  }

  useEffect(() => {
    return () => { audio.stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (contentScenes.length === 0) {
    return (
      <div className="swt-shell">
        <div className="swt-status">표시할 페이지가 없어요.</div>
      </div>
    )
  }

  return (
    <div className="swt-shell">
      <header className="swt-topbar">
        <button type="button" className="swt-exit-btn" onClick={handleExit} aria-label="닫기">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="swt-title">{title}</h1>
        <div className="swt-topbar-actions">
          <button
            type="button"
            className={`swt-auto-btn ${isPlayingCurrentPage ? 'swt-auto-btn--active' : ''}`}
            onClick={togglePagePlay}
            disabled={!currentScene}
          >
            {isPlayingCurrentPage ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                멈추기
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6,4 L20,12 L6,20 Z" />
                </svg>
                페이지별 읽기
              </>
            )}
          </button>
          <button
            type="button"
            className={`swt-auto-btn ${isAutoPlaying ? 'swt-auto-btn--active' : ''}`}
            onClick={toggleAutoPlay}
          >
            {isAutoPlaying ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                멈추기
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6,4 L20,12 L6,20 Z" />
                </svg>
                한번에 읽기
              </>
            )}
          </button>
          <button
            type="button"
            className={`swt-ko-toggle ${showPanel ? 'swt-ko-toggle--active' : ''}`}
            onClick={() => setShowPanel(v => !v)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {showPanel
                ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
              }
            </svg>
            본문보기
          </button>
          <span className="swt-page-indicator">
            {Math.min(currentPage + 1, totalPages)} / {totalPages}
          </span>
        </div>
      </header>

      <div className="swt-scroll-area" ref={scrollRef}>
        {/* 표지 */}
        <div className="swt-page-snap" data-page-index={0}>
          <BookCover title={title} illustrationUrl={story.coverIllustrationUrl} />
        </div>

        {contentScenes.map((scene, index) => (
          <WebtoonPageView
            key={scene.sceneId}
            storyId={story.storyId}
            scene={scene}
            isOwner={isOwner}
            activeSentenceId={
              audio.activeSceneId === scene.sceneId ? audio.activeSentenceId : null
            }
            pageIndex={index + 1}
            onRetryRequested={() => {}}
          />
        ))}

        {hasOutro && (
          <div className="swt-page-snap" data-page-index={contentScenes.length + 1}>
            <BookBackCover
              outro={story.outro}
              onRestart={() => scrollToPage(0)}
              illustrationUrl={story.coverIllustrationUrl}
              hideRestart
              title={title}
              disableAutoAudio
              showLetter={outroReached}
            />
          </div>
        )}
      </div>

      {/* 본문보기 사이드 패널 */}
      <aside className={`swt-ko-panel ${showPanel ? 'swt-ko-panel--open' : ''}`}>
        <div className="swt-ko-panel-header">
          <div className="swt-panel-tabs">
            <button
              type="button"
              className={`swt-panel-tab ${panelTab === 'korean' ? 'swt-panel-tab--active' : ''}`}
              onClick={() => setPanelTab('korean')}
            >
              한글 해석
            </button>
            <button
              type="button"
              className={`swt-panel-tab ${panelTab === 'english' ? 'swt-panel-tab--active' : ''}`}
              onClick={() => setPanelTab('english')}
            >
              영어 본문
            </button>
          </div>
          <button
            type="button"
            className="swt-ko-panel-close"
            onClick={() => setShowPanel(false)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {currentScene ? (
          <div className="swt-ko-panel-body">
            {panelTab === 'korean'
              ? currentScene.sentences.map(sentence =>
                  sentence.koreanText ? (
                    <p
                      key={sentence.sentenceId}
                      className={`swt-ko-panel-line ${
                        audio.activeSentenceId === sentence.sentenceId ? 'swt-ko-panel-line--playing' : ''
                      }`}
                    >
                      {!isNarration(sentence) && sentence.speakerKey ? (
                        <><span className="swt-ko-panel-speaker">{sentence.speakerKey}</span>: {sentence.koreanText}</>
                      ) : (
                        sentence.koreanText
                      )}
                    </p>
                  ) : null,
                )
              : currentScene.sentences.map(sentence => (
                  <p
                    key={sentence.sentenceId}
                    className={`swt-ko-panel-line ${
                      audio.activeSentenceId === sentence.sentenceId ? 'swt-ko-panel-line--playing' : ''
                    }`}
                  >
                    {!isNarration(sentence) && sentence.speakerKey && (
                      <><span className="swt-ko-panel-speaker">{sentence.speakerKey}</span>:{' '}</>
                    )}
                    {tokenize(sentence.englishText).map((tok, i) =>
                      tok.kind === 'word' ? (
                        <button
                          key={i}
                          type="button"
                          className="swt-word-btn"
                          onClick={() => handleWordClick(tok.text)}
                          title={`'${tok.text}' 뜻 보기`}
                        >
                          {tok.text}
                        </button>
                      ) : (
                        <span key={i}>{tok.text}</span>
                      ),
                    )}
                  </p>
                ))}
          </div>
        ) : (
          <div className="swt-ko-panel-empty" />
        )}
      </aside>

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
