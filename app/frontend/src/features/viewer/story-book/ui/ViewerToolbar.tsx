import { useEffect, useState } from 'react'
import { Play, Pause, PlayCircle, Square, Languages, Type } from 'lucide-react'
import type { SceneView } from '../../model/types'

interface ViewerToolbarProps {
  isOpen: boolean
  currentScene: SceneView | null
  showTranslation: boolean
  fontSize: number
  onTranslationToggle: () => void
  onFontSizeChange: (value: number) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

/**
 * 뷰어 사이드 툴바.
 * - TTS: 현재 페이지 읽기 / 일시정지 / 이어듣기 / 정지
 *   (MVP 단계: 문장별 `ttsAudioUrl` 이 없으면 브라우저 SpeechSynthesis 로 폴백)
 * - 한글 해석 토글, 글자 크기 슬라이더
 */
export function ViewerToolbar({
  isOpen,
  currentScene,
  showTranslation,
  fontSize,
  onTranslationToggle,
  onFontSizeChange,
  onMouseEnter,
  onMouseLeave,
}: ViewerToolbarProps) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  // 언마운트 / 페이지 이동 시 음성 정리
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    // 페이지 바뀌면 현재 재생 중단
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
  }, [currentScene?.sceneId])

  const hasTts = 'speechSynthesis' in window

  const speakCurrentPage = () => {
    if (!hasTts || !currentScene) return
    const text = currentScene.sentences.map(s => s.englishText).join(' ')
    if (!text.trim()) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    utter.rate = 0.95
    utter.onend = () => {
      setIsSpeaking(false)
      setIsPaused(false)
    }
    utter.onerror = () => {
      setIsSpeaking(false)
      setIsPaused(false)
    }
    window.speechSynthesis.speak(utter)
    setIsSpeaking(true)
    setIsPaused(false)
  }
  const pauseTts = () => {
    if (!hasTts || !isSpeaking) return
    window.speechSynthesis.pause()
    setIsPaused(true)
  }
  const resumeTts = () => {
    if (!hasTts || !isPaused) return
    window.speechSynthesis.resume()
    setIsPaused(false)
  }
  const stopTts = () => {
    if (!hasTts) return
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
  }

  return (
    <aside
      className={`sb-side-toolbar ${isOpen ? '' : 'is-collapsed'}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-hidden={!isOpen}
    >
      <div className="sb-toolbar-card">
        <h3 className="sb-toolbar-title">읽기 도구</h3>

        {/* TTS 재생 */}
        <div className="sb-toolbar-section">
          <p className="sb-toolbar-section-label">음성 읽기 (영어)</p>
          <button
            className="sb-toolbar-btn is-primary"
            onClick={speakCurrentPage}
            disabled={!hasTts || !currentScene}
            title={hasTts ? '현재 페이지 읽기' : '브라우저가 TTS를 지원하지 않아요'}
          >
            <Play className="w-4 h-4" />
            현재 페이지 읽기
          </button>
          <div className="sb-toolbar-row">
            <button
              className="sb-toolbar-btn"
              onClick={pauseTts}
              disabled={!isSpeaking || isPaused}
              title="일시정지"
            >
              <Pause className="w-4 h-4" />
              일시정지
            </button>
            <button
              className="sb-toolbar-btn"
              onClick={resumeTts}
              disabled={!isPaused}
              title="이어듣기"
            >
              <PlayCircle className="w-4 h-4" />
              이어듣기
            </button>
            <button
              className="sb-toolbar-btn"
              onClick={stopTts}
              disabled={!isSpeaking && !isPaused}
              title="정지"
            >
              <Square className="w-4 h-4" />
              정지
            </button>
          </div>
        </div>

        {/* 한글 해석 토글 */}
        <div className="sb-toolbar-section">
          <p className="sb-toolbar-section-label">보기 설정</p>
          <button
            className={`sb-toolbar-btn ${showTranslation ? 'is-active' : ''}`}
            onClick={onTranslationToggle}
          >
            <Languages className="w-4 h-4" />
            {showTranslation ? '한글 해석 숨기기' : '한글 해석 보기'}
          </button>
        </div>

        {/* 글자 크기 */}
        <div className="sb-toolbar-section">
          <div className="flex items-center justify-between mb-2">
            <p className="sb-toolbar-section-label m-0 flex items-center gap-1">
              <Type className="w-3.5 h-3.5" />
              글자 크기
            </p>
            <span className="text-xs text-[#8d6e63]">{fontSize}px</span>
          </div>
          <input
            type="range"
            min={16}
            max={32}
            step={1}
            value={fontSize}
            onChange={e => onFontSizeChange(Number(e.target.value))}
            className="sb-toolbar-range"
          />
        </div>
      </div>
    </aside>
  )
}
