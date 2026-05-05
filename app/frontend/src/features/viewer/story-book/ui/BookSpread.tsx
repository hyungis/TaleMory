import { ImageIcon, Play, Volume2 } from 'lucide-react'
import type { SceneView, SentenceView } from '../../model/types'

interface LeftPageProps {
  scene: SceneView
  pageIndex: number
  onIllustrationClick?: (scene: SceneView) => void
}

/** 왼쪽 페이지 — 삽화 + 캡션. 플립 시트의 face 로도 재사용. */
export function BookSpreadLeft({ scene, pageIndex, onIllustrationClick }: LeftPageProps) {
  const illustStyle = { '--illust-a': '#c9d8b2', '--illust-b': '#e8c79b' } as React.CSSProperties
  const clickable = Boolean(onIllustrationClick)
  return (
    <div className="sb-page left">
      <div className="sb-illust">
        <button
          type="button"
          className="sb-illust-art"
          style={illustStyle}
          onClick={clickable ? () => onIllustrationClick!(scene) : undefined}
          disabled={!clickable}
          aria-label={clickable ? `Page ${scene.pageNumber} 그림 확대` : undefined}
        >
          {scene.illustrationUrl ? (
            <img src={scene.illustrationUrl} alt={`Page ${scene.pageNumber} 삽화`} />
          ) : (
            <ImageIcon className="sb-illust-empty-icon" strokeWidth={1.5} />
          )}
        </button>
        <p className="sb-illust-caption">Page {scene.pageNumber} 장면</p>
      </div>
      <span className="sb-page-num left">{pageIndex * 2 + 1}</span>
    </div>
  )
}

interface RightPageProps {
  scene: SceneView
  pageIndex: number
  showTranslation?: boolean
  fontSize?: number
  activeSentenceId?: number | null
  onSentenceClick?: (scene: SceneView, sentence: SentenceView) => void
  onWordClick?: (word: string) => void
  onPlayPage?: (scene: SceneView) => void
}

interface Token {
  kind: 'word' | 'nonword'
  text: string
}

/** 영어 본문을 단어 / 비단어 토큰으로 쪼갠다 (단어만 클릭 가능하게 만들기 위함). */
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

/** 오른쪽 페이지 — 본문 텍스트. 플립 시트의 face 로도 재사용. */
export function BookSpreadRight({
  scene,
  pageIndex,
  showTranslation = false,
  fontSize,
  activeSentenceId = null,
  onSentenceClick,
  onWordClick,
  onPlayPage,
}: RightPageProps) {
  const bodyStyle = fontSize ? { fontSize: `${fontSize}px` } : undefined

  return (
    <div className="sb-page right">
      <div className="sb-body-header">
        <p className="sb-body-label">Page {scene.pageNumber}</p>
        {onPlayPage && (
          <button
            type="button"
            className="sb-page-play-btn"
            onClick={() => onPlayPage(scene)}
            title="이 페이지 읽어주기"
            aria-label={`Page ${scene.pageNumber} 재생`}
          >
            <Play className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <h2 className="sb-body-title">{`장면 ${scene.pageNumber}`}</h2>
      <p className="sb-body-text" style={bodyStyle}>
        {scene.sentences.map(sentence => {
          const isActive = activeSentenceId === sentence.sentenceId
          const tokens = tokenize(sentence.englishText)
          return (
            <span
              key={sentence.sentenceId}
              className={`sb-sentence ${isActive ? 'is-active' : ''}`}
            >
              {onSentenceClick && (
                <button
                  type="button"
                  className="sb-sentence-play"
                  onClick={() => onSentenceClick(scene, sentence)}
                  title="이 문장 읽기"
                  aria-label="문장 재생"
                >
                  <Volume2 className="w-3 h-3" />
                </button>
              )}
              {tokens.map((tok, i) =>
                tok.kind === 'word' && onWordClick ? (
                  <button
                    key={i}
                    type="button"
                    className="sb-word-btn"
                    onClick={() => onWordClick(tok.text)}
                    title={`'${tok.text}' 뜻 보기`}
                  >
                    {tok.text}
                  </button>
                ) : (
                  <span key={i}>{tok.text}</span>
                ),
              )}{' '}
            </span>
          )
        })}
      </p>
      {showTranslation && (
        <div className="sb-body-translation">
          {scene.sentences.map(s => s.koreanText).filter(Boolean).join(' ')}
        </div>
      )}
      <span className="sb-page-num right">{pageIndex * 2 + 2}</span>
    </div>
  )
}

interface BookSpreadProps {
  scene: SceneView
  pageIndex: number
  showTranslation: boolean
  fontSize?: number
  activeSentenceId?: number | null
  onSentenceClick?: (scene: SceneView, sentence: SentenceView) => void
  onWordClick?: (word: string) => void
  onPlayPage?: (scene: SceneView) => void
  onIllustrationClick?: (scene: SceneView) => void
}

/** 펼친 2페이지 스프레드 — 왼쪽 일러스트 + 오른쪽 본문. */
export function BookSpread({
  scene,
  pageIndex,
  showTranslation,
  fontSize,
  activeSentenceId,
  onSentenceClick,
  onWordClick,
  onPlayPage,
  onIllustrationClick,
}: BookSpreadProps) {
  return (
    <>
      <BookSpreadLeft
        scene={scene}
        pageIndex={pageIndex}
        onIllustrationClick={onIllustrationClick}
      />
      <BookSpreadRight
        scene={scene}
        pageIndex={pageIndex}
        showTranslation={showTranslation}
        fontSize={fontSize}
        activeSentenceId={activeSentenceId}
        onSentenceClick={onSentenceClick}
        onWordClick={onWordClick}
        onPlayPage={onPlayPage}
      />
    </>
  )
}
