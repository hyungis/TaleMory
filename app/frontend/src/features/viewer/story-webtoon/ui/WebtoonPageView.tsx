import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import type { SceneId, SentenceId, StoryId } from '../../../../shared/types'
import type { AnchorPoint, SceneView, SentenceView } from '../../model/types'
import { WebtoonBubble } from './WebtoonBubble'
import { retryWebtoonLayout } from '../api/retryWebtoonLayout'

interface WebtoonPageViewProps {
  storyId: StoryId
  scene: SceneView
  isOwner: boolean
  activeSentenceId: SentenceId | null
  isPlayingThisPage: boolean
  onTogglePlay: (scene: SceneView) => void
  pageIndex: number
  onRetryRequested: (sceneId: SceneId, jobId: string | number) => void
}

const FALLBACK_ANCHOR: AnchorPoint = { x: 0.5, y: 0.15 }

function isNarration(sentence: SentenceView): boolean {
  return !sentence.speakerKey || sentence.speakerKey === 'narrator' || sentence.speakerKey === 'narration'
}

export function WebtoonPageView({
  storyId,
  scene,
  isOwner,
  activeSentenceId,
  isPlayingThisPage,
  onTogglePlay,
  pageIndex,
  onRetryRequested,
}: WebtoonPageViewProps) {
  const anchorByName = useMemo(() => {
    const map = new Map<string, AnchorPoint>()
    for (const a of scene.characterAnchors) {
      if (a.name && a.x != null && a.y != null) {
        map.set(a.name, { x: a.x, y: a.y })
      }
    }
    return map
  }, [scene.characterAnchors])

  const narrations = useMemo(
    () => scene.sentences.filter(s => isNarration(s)),
    [scene.sentences],
  )

  const hasMissingAnchor = useMemo(
    () => scene.sentences.some(s => !isNarration(s) && s.speakerKey && !anchorByName.has(s.speakerKey)),
    [scene.sentences, anchorByName],
  )

  /* ── 이미지 실제 렌더링 영역 추적 (object-fit: contain 보정) ── */
  const wrapRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgLayout, setImgLayout] = useState<{
    offsetX: number; offsetY: number; width: number; height: number
  } | null>(null)

  const updateImgLayout = useCallback(() => {
    const img = imgRef.current
    const wrap = wrapRef.current
    if (!img || !wrap || !img.naturalWidth) return
    const wrapRect = wrap.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()
    setImgLayout({
      offsetX: imgRect.left - wrapRect.left,
      offsetY: imgRect.top - wrapRect.top,
      width: imgRect.width,
      height: imgRect.height,
    })
  }, [])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    img.addEventListener('load', updateImgLayout)
    window.addEventListener('resize', updateImgLayout)
    if (img.complete) updateImgLayout()
    return () => {
      img.removeEventListener('load', updateImgLayout)
      window.removeEventListener('resize', updateImgLayout)
    }
  }, [updateImgLayout])

  const [retryStatus, setRetryStatus] = useState<'idle' | 'pending' | 'failed'>('idle')

  const handleRetry = async () => {
    setRetryStatus('pending')
    try {
      const result = await retryWebtoonLayout(storyId, scene.pageNumber)
      onRetryRequested(scene.sceneId, result.jobId as unknown as string)
      setRetryStatus('idle')
    } catch {
      setRetryStatus('failed')
    }
  }

  const activeSentence = activeSentenceId
    ? scene.sentences.find(s => s.sentenceId === activeSentenceId)
    : null
  const showBubble = activeSentence && !isNarration(activeSentence)

  return (
    <div className="swt-page-snap" data-page-index={pageIndex}>
      <div className="swt-scene-content">
        {/* 이미지 + 말풍선 */}
        <div className="swt-scene-img-wrap" ref={wrapRef}>
          {scene.illustrationUrl ? (
            <img
              ref={imgRef}
              className="swt-scene-img"
              src={scene.illustrationUrl}
              alt={`${scene.pageNumber}페이지 삽화`}
              loading="lazy"
            />
          ) : (
            <div className="swt-scene-placeholder">
              <span className="swt-placeholder-text">{scene.pageNumber}페이지</span>
            </div>
          )}

          {/* 이미지 실제 영역에 맞춘 오버레이 (말풍선 + 나레이션) */}
          {imgLayout && (
            <div
              className="swt-img-overlay"
              style={{
                left: imgLayout.offsetX,
                top: imgLayout.offsetY,
                width: imgLayout.width,
                height: imgLayout.height,
              }}
            >
              {showBubble && activeSentence && (
                <WebtoonBubble
                  sentence={activeSentence}
                  position={
                    activeSentence.speakerKey
                      ? (anchorByName.get(activeSentence.speakerKey) ?? FALLBACK_ANCHOR)
                      : FALLBACK_ANCHOR
                  }
                />
              )}

              {narrations.length > 0 && (
                <div className="swt-en-box">
                  {narrations.map(sentence => (
                    <p
                      key={sentence.sentenceId}
                      className={`swt-en-line ${activeSentenceId === sentence.sentenceId ? 'swt-en-line--playing' : ''}`}
                    >
                      {sentence.englishText}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 페이지별 재생 버튼 */}
          <button
            type="button"
            className={`swt-play-btn ${isPlayingThisPage ? 'swt-play-btn--active' : ''}`}
            onClick={() => onTogglePlay(scene)}
            aria-label={isPlayingThisPage ? '정지' : '재생'}
          >
            {isPlayingThisPage ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6,4 L20,12 L6,20 Z" />
              </svg>
            )}
          </button>
        </div>

        {/* 좌표 재시도 배너 */}
        {hasMissingAnchor && isOwner && (
          <div className={`swt-retry-banner${retryStatus === 'pending' ? ' is-busy' : ''}`} role="alert">
            <span>
              {retryStatus === 'failed'
                ? '재시도 요청에 실패했어요. 잠시 후 다시 시도해주세요.'
                : '말풍선 위치를 못 찾은 문장이 있어요.'}
            </span>
            <button type="button" onClick={handleRetry} disabled={retryStatus === 'pending'}>
              <RefreshCw className="w-3 h-3" />{' '}
              {retryStatus === 'pending' ? '요청 중...' : '좌표 다시 추출'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
