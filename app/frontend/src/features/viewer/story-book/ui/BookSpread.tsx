import { ImageIcon } from 'lucide-react'
import type { SceneView } from '../../model/types'

interface BookSpreadProps {
  scene: SceneView
  pageIndex: number
  showTranslation: boolean
}

/** 펼친 2페이지 스프레드 — 왼쪽 일러스트 / 오른쪽 본문. */
export function BookSpread({ scene, pageIndex, showTranslation }: BookSpreadProps) {
  const illustStyle = {
    '--illust-a': '#c4e3b4',
    '--illust-b': '#f7c59f',
  } as React.CSSProperties

  return (
    <>
      <div className="sb-page left">
        <div className="sb-illust">
          <div className="sb-illust-art" style={illustStyle}>
            {scene.illustrationUrl ? (
              <img src={scene.illustrationUrl} alt={`Page ${scene.pageNumber} 삽화`} />
            ) : (
              <ImageIcon className="w-32 h-32 md:w-40 md:h-40 text-white/95 drop-shadow-[0_8px_16px_rgba(0,0,0,0.15)]" strokeWidth={1.5} />
            )}
          </div>
          <p className="sb-illust-caption">Page {scene.pageNumber} 장면</p>
        </div>
        <span className="sb-page-num left">{pageIndex * 2 + 1}</span>
      </div>

      <div className="sb-page right">
        <p className="sb-body-label">Page {scene.pageNumber}</p>
        <h2 className="sb-body-title">{`장면 ${scene.pageNumber}`}</h2>
        <p className="sb-body-text">
          {scene.sentences.map(sentence => (
            <span key={sentence.sentenceId} className="inline rounded-md px-1 mr-1">
              {sentence.englishText}{' '}
            </span>
          ))}
        </p>

        {showTranslation && (
          <div className="sb-body-translation">
            {scene.sentences.map(sentence => sentence.koreanText).filter(Boolean).join(' ')}
          </div>
        )}

        <span className="sb-page-num right">{pageIndex * 2 + 2}</span>
      </div>
    </>
  )
}
