import { useEffect } from 'react'
import { X, BookMarked } from 'lucide-react'
import type { WordEntry } from '../../model/types'

interface WordLookupCardProps {
  word: string
  entries: WordEntry[]
  isLoading: boolean
  onClose: () => void
}

/**
 * 단어 번역 팝업 카드.
 * 본문 내 단어 클릭 시 화면 하단 중앙에 슬라이드 인 — ESC / X 버튼으로 닫힘.
 * 같은 단어가 품사별로 여러 건일 수 있고, pos/ipa/forms 는 null 일 수 있다.
 */
export function WordLookupCard({ word, entries, isLoading, onClose }: WordLookupCardProps) {
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
        <p className="sb-word-card-word">
          {word}
          {entries.length > 0 && entries[0].ipa && (
            <span className="sb-word-card-ipa"> {entries[0].ipa}</span>
          )}
        </p>
        {isLoading ? (
          <p className="sb-word-card-meaning is-loading">뜻을 찾는 중이에요…</p>
        ) : entries.length > 0 ? (
          <ul className="sb-word-card-entries">
            {entries.map((entry, i) => (
              <li key={i} className="sb-word-card-entry">
                {entry.pos && <span className="sb-word-card-pos">{entry.pos}</span>}
                <span>{entry.definitionKo}</span>
              </li>
            ))}
          </ul>
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
