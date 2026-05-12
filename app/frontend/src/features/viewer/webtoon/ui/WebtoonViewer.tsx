import { useCallback, useEffect, useRef, useState } from 'react'
import type { StoryView, SentenceView, BubbleSlot } from '../../model/types'
import { BookBackCover } from '../../story-book/ui/BookBackCover'
import '../../story-book/styles/story-book.css'
import '../styles/webtoon-viewer.css'

interface WebtoonViewerProps {
  story: StoryView
}

/** speakerKey 가 없거나 "narrator" 이면 나레이션으로 취급. */
function isNarration(sentence: SentenceView): boolean {
  return !sentence.speakerKey || sentence.speakerKey === 'narrator'
}

/** bubbleSlot → CSS position 클래스 매핑. */
function bubblePositionClass(slot: BubbleSlot | null): string {
  if (!slot) return 'wv-bubble--top-center'
  return `wv-bubble--${slot.toLowerCase().replace('_', '-')}`
}

/**
 * 웹툰 모드 뷰어 — 세로 스냅 스크롤.
 * - 나레이션: 이미지 하단 반투명 박스
 * - 대사: 이미지 위 말풍선 (bubbleSlot 기반 배치)
 * - 한번에 읽기: TTS 순차 재생 후 자동 페이지 넘김
 * - 아웃트로: story.outro 존재 시 BookBackCover 재사용
 */
export function WebtoonViewer({ story }: WebtoonViewerProps) {
  const title = story.title?.trim() || '제목 없는 동화'
  const scrollRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [playingSentenceId, setPlayingSentenceId] = useState<number | null>(null)
  const [showKorean, setShowKorean] = useState(false)

  const hasOutro = !!story.outro
  const totalPages = story.scenes.length + (hasOutro ? 1 : 0)

  // --- 현재 보이는 페이지 감지 ---
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-page-index'))
            if (!Number.isNaN(index)) setCurrentPage(index)
          }
        }
      },
      { root: container, threshold: 0.5 },
    )

    const pages = container.querySelectorAll('[data-page-index]')
    pages.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [story.scenes.length, hasOutro])

  // --- 특정 페이지로 스크롤 ---
  const scrollToPage = useCallback((index: number) => {
    const container = scrollRef.current
    if (!container) return
    const target = container.querySelector(`[data-page-index="${index}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // --- TTS 재생 ---
  const playSentences = useCallback(
    (sentences: SentenceView[]): Promise<void> => {
      return new Promise((resolve) => {
        const ttsQueue = sentences.filter((s) => s.ttsAudioUrl)

        if (ttsQueue.length === 0) {
          setTimeout(resolve, 3000)
          return
        }

        let idx = 0
        const playNext = () => {
          if (idx >= ttsQueue.length) {
            setPlayingSentenceId(null)
            setTimeout(resolve, 1000)
            return
          }

          const sentence = ttsQueue[idx]
          setPlayingSentenceId(sentence.sentenceId as number)

          const audio = new Audio(sentence.ttsAudioUrl!)
          audioRef.current = audio

          audio.onended = () => { idx++; playNext() }
          audio.onerror = () => { idx++; playNext() }
          audio.play().catch(() => { idx++; playNext() })
        }

        playNext()
      })
    },
    [],
  )

  // --- 아웃트로 TTS ---
  const playOutroAudio = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (!story.outro?.audioUrl) {
        setTimeout(resolve, 3000)
        return
      }
      const audio = new Audio(story.outro.audioUrl)
      audioRef.current = audio
      audio.onended = () => setTimeout(resolve, 1000)
      audio.onerror = () => resolve()
      audio.play().catch(() => resolve())
    })
  }, [story.outro])

  // --- 자동 재생 루프 ---
  const isAutoPlayingRef = useRef(false)
  isAutoPlayingRef.current = isAutoPlaying

  const runAutoPlay = useCallback(
    async (startPage: number) => {
      for (let page = startPage; page < totalPages; page++) {
        if (!isAutoPlayingRef.current) break
        scrollToPage(page)
        await new Promise((r) => setTimeout(r, 600))
        if (!isAutoPlayingRef.current) break

        if (page < story.scenes.length) {
          await playSentences(story.scenes[page].sentences)
        } else if (hasOutro) {
          await playOutroAudio()
        }
      }
      setIsAutoPlaying(false)
      setPlayingSentenceId(null)
    },
    [totalPages, story.scenes, hasOutro, scrollToPage, playSentences, playOutroAudio],
  )

  useEffect(() => {
    if (isAutoPlaying) runAutoPlay(currentPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoPlaying])

  // 수동 스크롤 시 자동 중지
  useEffect(() => {
    const container = scrollRef.current
    if (!container || !isAutoPlaying) return

    const stop = () => {
      setIsAutoPlaying(false)
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
      setPlayingSentenceId(null)
    }

    container.addEventListener('wheel', stop, { passive: true })
    container.addEventListener('touchmove', stop, { passive: true })
    return () => {
      container.removeEventListener('wheel', stop)
      container.removeEventListener('touchmove', stop)
    }
  }, [isAutoPlaying])

  const toggleAutoPlay = () => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false)
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
      setPlayingSentenceId(null)
    } else {
      const startPage = currentPage >= totalPages - 1 ? 0 : currentPage
      if (startPage === 0) scrollToPage(0)
      setIsAutoPlaying(true)
    }
  }

  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }
  }, [])

  return (
    <div className="wv-shell">
      <header className="wv-topbar">
        <h1 className="wv-title">{title}</h1>
        <div className="wv-topbar-actions">
          <button
            type="button"
            className={`wv-auto-btn ${isAutoPlaying ? 'wv-auto-btn--active' : ''}`}
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
            className={`wv-ko-toggle ${showKorean ? 'wv-ko-toggle--active' : ''}`}
            onClick={() => setShowKorean((v) => !v)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {showKorean
                ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
              }
            </svg>
            한글 해석
          </button>
          <span className="wv-page-indicator">
            {Math.min(currentPage + 1, totalPages)} / {totalPages}
          </span>
        </div>
      </header>

      <div className="wv-scroll-area" ref={scrollRef}>
        {story.scenes.map((scene, index) => {
          const dialogues = scene.sentences.filter((s) => !isNarration(s))

          return (
            <div key={scene.sceneId} className="wv-scene" data-page-index={index}>
              <div className="wv-scene-content">
                {/* 이미지 + 말풍선 오버레이 */}
                <div className="wv-scene-img-wrap">
                  {scene.illustrationUrl ? (
                    <img
                      className="wv-scene-img"
                      src={scene.illustrationUrl}
                      alt={`${scene.pageNumber}페이지 삽화`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="wv-scene-placeholder">
                      <span className="wv-placeholder-text">{scene.pageNumber}페이지</span>
                    </div>
                  )}

                  {/* 디자인 프리뷰용 더미 말풍선 A/B/M 비교 (첫 페이지만) */}
                  {index === 0 && (
                    <>
                      <div className="wv-bubble wv-bubble--top-left">
                        <span className="wv-bubble-label">A. 기본</span>
                        <span className="wv-bubble-speaker">토끼</span>
                        <p className="wv-bubble-text">안녕! 오늘 숲에서 만나자!</p>
                      </div>
                      <div className="wv-bubble wv-bubble--top-right wv-bubble--style-cloud">
                        <span className="wv-bubble-label">B. 구름형</span>
                        <span className="wv-bubble-speaker">토끼</span>
                        <p className="wv-bubble-text">안녕! 오늘 숲에서 만나자!</p>
                      </div>
                      <div className="wv-bubble wv-bubble--bottom-center wv-bubble--style-wavy">
                        <span className="wv-bubble-label">M. 물결</span>
                        <span className="wv-bubble-speaker">토끼</span>
                        <p className="wv-bubble-text">안녕! 오늘 숲에서 만나자!</p>
                      </div>
                    </>
                  )}

                  {/* 대사 말풍선 — 이미지 위에 absolute 배치 */}
                  {dialogues.map((sentence) => (
                    <div
                      key={sentence.sentenceId}
                      className={`wv-bubble ${bubblePositionClass(sentence.bubbleSlot)} ${
                        playingSentenceId === (sentence.sentenceId as number) ? 'wv-bubble--playing' : ''
                      }`}
                    >
                      {sentence.speakerKey && (
                        <span className="wv-bubble-speaker">{sentence.speakerKey}</span>
                      )}
                      <p className="wv-bubble-text">
                        {sentence.koreanText || sentence.englishText}
                      </p>
                    </div>
                  ))}

                  {/* 영어 본문 — 이미지 하단 오버레이 */}
                  {scene.sentences.length > 0 && (
                    <div className="wv-en-overlay">
                      {scene.sentences.map((sentence) => (
                        <p
                          key={sentence.sentenceId}
                          className={`wv-en-line ${
                            playingSentenceId === (sentence.sentenceId as number) ? 'wv-en-line--playing' : ''
                          }`}
                        >
                          {sentence.englishText}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* 한글 본문 — 이미지 아래 박스 (블러 토글) */}
                {scene.sentences.some((s) => s.koreanText) && (
                  <div className={`wv-ko-box ${showKorean ? '' : 'wv-ko-box--blurred'}`}>
                    {scene.sentences.map((sentence) => (
                      sentence.koreanText && (
                        <p
                          key={sentence.sentenceId}
                          className={`wv-ko-line ${
                            playingSentenceId === (sentence.sentenceId as number) ? 'wv-ko-line--playing' : ''
                          }`}
                        >
                          {sentence.koreanText}
                        </p>
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* 아웃트로 */}
        {hasOutro && (
          <div className="wv-scene wv-outro-page" data-page-index={story.scenes.length}>
            <BookBackCover
              outro={story.outro}
              onRestart={() => scrollToPage(0)}
              illustrationUrl={story.coverIllustrationUrl}
            />
          </div>
        )}
      </div>
    </div>
  )
}
