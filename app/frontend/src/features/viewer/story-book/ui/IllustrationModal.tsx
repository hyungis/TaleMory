import { useEffect } from 'react'
import { X, ImageIcon } from 'lucide-react'
import type { SceneView } from '../../model/types'

interface IllustrationModalProps {
  scene: SceneView | null
  onClose: () => void
}

/**
 * 삽화 확대 모달.
 * 페이지 왼쪽 일러스트를 클릭하면 이 모달로 전체화면 확대 표시.
 * ESC / 배경 클릭 / [X] 버튼 으로 닫힘.
 */
export function IllustrationModal({ scene, onClose }: IllustrationModalProps) {
  useEffect(() => {
    if (!scene) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    // capture 로 등록해 StoryBookViewer 의 ESC(뷰어 닫기) 보다 먼저 처리
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [scene, onClose])

  if (!scene) return null

  const illustStyle = { '--illust-a': '#c9d8b2', '--illust-b': '#e8c79b' } as React.CSSProperties

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="sb-illust-modal-overlay"
      onClick={onClose}
    >
      <div
        className="sb-illust-modal-body"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className="sb-illust-modal-close"
          onClick={onClose}
          aria-label="모달 닫기"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="sb-illust-modal-art" style={illustStyle}>
          {scene.illustrationUrl ? (
            <img src={scene.illustrationUrl} alt={`Page ${scene.pageNumber} 확대 삽화`} />
          ) : (
            <ImageIcon className="sb-illust-modal-empty-icon" strokeWidth={1.5} />
          )}
        </div>

        <div className="sb-illust-modal-caption">
          <p className="sb-illust-modal-label">Page {scene.pageNumber}</p>
          <h3 className="sb-illust-modal-title">{`장면 ${scene.pageNumber}`}</h3>
        </div>
      </div>
    </div>
  )
}
