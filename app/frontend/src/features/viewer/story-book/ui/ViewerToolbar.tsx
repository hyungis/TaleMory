import { BookAudio, Pause, PlayCircle, Square, Languages, Type, Bookmark, BookmarkCheck, Palette, ArrowRightToLine } from 'lucide-react'

export type ViewerTheme = 'forest' | 'sunset' | 'night'

interface ViewerToolbarProps {
  isOpen: boolean
  ttsMode: 'idle' | 'playing' | 'paused'
  showTranslation: boolean
  fontSize: number
  // 책갈피 (한 동화당 1개)
  canBookmark: boolean
  isBookmarked: boolean
  bookmarkLabel: string | null       // "Page N" 같은 표시 문자열 — 없으면 null
  canJumpToBookmark: boolean         // 저장된 책갈피가 현재 페이지가 아닐 때만 true
  // 테마
  theme: ViewerTheme
  // 액션
  onPlayFullBook: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onTranslationToggle: () => void
  onFontSizeChange: (value: number) => void
  onToggleBookmark: () => void
  onJumpToBookmark: () => void
  onThemeChange: (theme: ViewerTheme) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

const THEME_OPTIONS: Array<{ value: ViewerTheme; label: string }> = [
  { value: 'forest', label: '숲' },
  { value: 'sunset', label: '노을' },
  { value: 'night', label: '밤하늘' },
]

/**
 * 뷰어 사이드 툴바.
 * - TTS 컨트롤 (전체 재생 / 일시정지 / 이어듣기 / 정지)
 * - 한글 해석 토글
 * - 글자 크기 슬라이더
 * - 책갈피 (한 동화당 1개 — 토글 / 저장된 페이지로 점프)
 * - 테마 3종 (숲 / 노을 / 밤하늘)
 */
export function ViewerToolbar({
  isOpen,
  ttsMode,
  showTranslation,
  fontSize,
  canBookmark,
  isBookmarked,
  bookmarkLabel,
  canJumpToBookmark,
  theme,
  onPlayFullBook,
  onPause,
  onResume,
  onStop,
  onTranslationToggle,
  onFontSizeChange,
  onToggleBookmark,
  onJumpToBookmark,
  onThemeChange,
  onMouseEnter,
  onMouseLeave,
}: ViewerToolbarProps) {
  const isPlaying = ttsMode === 'playing'
  const isPaused = ttsMode === 'paused'

  return (
    <aside
      className={`sb-side-toolbar ${isOpen ? '' : 'is-collapsed'}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-hidden={!isOpen}
    >
      <div className="sb-toolbar-card">
        <h3 className="sb-toolbar-title">읽기 도구</h3>

        {/* TTS */}
        <div className="sb-toolbar-section">
          <p className="sb-toolbar-section-label">음성 읽기 (영어)</p>
          <button
            className="sb-toolbar-btn is-primary"
            onClick={onPlayFullBook}
            title="현재 페이지부터 끝까지 순서대로 읽기"
          >
            <BookAudio className="w-4 h-4" />
            처음부터 끝까지 읽기
          </button>
          <div className="sb-toolbar-row">
            <button className="sb-toolbar-btn" onClick={onPause} disabled={!isPlaying} title="일시정지">
              <Pause className="w-4 h-4" />
              일시정지
            </button>
            <button className="sb-toolbar-btn" onClick={onResume} disabled={!isPaused} title="이어듣기">
              <PlayCircle className="w-4 h-4" />
              이어듣기
            </button>
            <button className="sb-toolbar-btn" onClick={onStop} disabled={!isPlaying && !isPaused} title="정지">
              <Square className="w-4 h-4" />
              정지
            </button>
          </div>
        </div>

        {/* 한글 해석 */}
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

        {/* 책갈피 (한 동화당 1개) */}
        <div className="sb-toolbar-section">
          <p className="sb-toolbar-section-label">책갈피</p>
          <button
            className={`sb-toolbar-btn ${isBookmarked ? 'is-active' : ''}`}
            onClick={onToggleBookmark}
            disabled={!canBookmark}
            title={canBookmark
              ? (isBookmarked ? '현재 페이지 책갈피 제거' : '현재 페이지에 책갈피 저장')
              : '표지/뒷표지에는 책갈피를 저장할 수 없어요'}
          >
            {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            {isBookmarked ? '이 페이지 책갈피 해제' : '이 페이지에 책갈피 저장'}
          </button>
          {bookmarkLabel ? (
            <div className="sb-bookmark-status">
              <span className="sb-bookmark-status-text">
                책갈피: <strong>{bookmarkLabel}</strong>
              </span>
              <button
                type="button"
                className="sb-bookmark-jump"
                onClick={onJumpToBookmark}
                disabled={!canJumpToBookmark}
                title={canJumpToBookmark ? '책갈피 페이지로 이동' : '이미 책갈피 페이지에 있어요'}
              >
                <ArrowRightToLine className="w-3.5 h-3.5" />
                이동
              </button>
            </div>
          ) : (
            <p className="sb-bookmark-empty">아직 저장된 책갈피가 없어요</p>
          )}
        </div>

        {/* 테마 */}
        <div className="sb-toolbar-section">
          <p className="sb-toolbar-section-label flex items-center gap-1">
            <Palette className="w-3.5 h-3.5" />
            테마
          </p>
          <div className="sb-theme-swatches">
            {THEME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`sb-theme-swatch ${theme === opt.value ? 'is-active' : ''}`}
                onClick={() => onThemeChange(opt.value)}
                title={`${opt.label} 테마`}
              >
                <span className={`sb-theme-swatch-chip is-${opt.value}`} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
