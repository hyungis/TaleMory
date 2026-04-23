import { useEffect } from 'react'
import { X, BookMarked } from 'lucide-react'

interface WordLookupCardProps {
  word: string
  meaning: string | null
  isLoading: boolean
  onClose: () => void
}

/**
 * 단어 번역 팝업 카드.
 * 본문 내 단어 클릭 시 화면 하단 중앙에 슬라이드 인 — ESC / X 버튼으로 닫힘.
 * 뜻이 `null` 이면 미등록 단어 안내를 표시한다.
 */
export function WordLookupCard({ word, meaning, isLoading, onClose }: WordLookupCardProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    // capture 로 등록해 StoryBookViewer 의 ESC(뷰어 닫기) 보다 먼저 처리
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="sb-word-card" role="dialog" aria-live="polite">
      <div className="sb-word-card-icon">
        <BookMarked className="w-5 h-5" />
      </div>
      <div className="sb-word-card-content">
        <p className="sb-word-card-word">{word}</p>
        {isLoading ? (
          <p className="sb-word-card-meaning is-loading">뜻을 찾는 중이에요…</p>
        ) : meaning ? (
          <p className="sb-word-card-meaning">{meaning}</p>
        ) : (
          <p className="sb-word-card-meaning is-missing">아직 사전에 등록되지 않은 단어예요.</p>
        )}
      </div>
      <button
        type="button"
        className="sb-word-card-close"
        onClick={onClose}
        aria-label="단어 번역 닫기"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
