import { useState } from 'react'
import { ImageIcon, Pause, Play, RefreshCw } from 'lucide-react'
import type { SceneId, SentenceId, StoryId } from '../../../../shared/types'
import type { AnchorPoint, SceneView } from '../../model/types'
import { WebtoonBubble } from './WebtoonBubble'
import { retryWebtoonLayout } from '../api/retryWebtoonLayout'

interface WebtoonPageViewProps {
  storyId: StoryId
  scene: SceneView
  isOwner: boolean
  showKorean: boolean
  isPlayingThisPage: boolean
  activeSentenceId: SentenceId | null
  onTogglePlay: (scene: SceneView) => void
  onRetryRequested: (sceneId: SceneId, jobId: string | number) => void
}

/** sentence.bubbleSlot 이 null 일 때 사용할 fallback 좌표 — top-center. */
const FALLBACK_ANCHOR: AnchorPoint = { x: 0.5, y: 0.05 }

/**
 * 단일 페이지 뷰 — 이미지 + 말풍선 오버레이 + 페이지 액션 (재생 / 재시도).
 *
 * 부분 실패 (sentence.bubbleSlot == null) 가 있는 페이지는 본인 동화일 때 한해
 * [좌표 다시 추출] 배너를 노출 — 공개 공유 링크 (isOwner=false) 에서는 숨김.
 */
export function WebtoonPageView({
  storyId,
  scene,
  isOwner,
  showKorean,
  isPlayingThisPage,
  activeSentenceId,
  onTogglePlay,
  onRetryRequested,
}: WebtoonPageViewProps) {
  const hasMissingAnchor =
    scene.sentences.some(s => s.bubbleSlot == null && s.speakerKey)
  const [retryStatus, setRetryStatus] = useState<'idle' | 'pending' | 'failed'>('idle')

  const handleRetry = async () => {
    setRetryStatus('pending')
    try {
      const result = await retryWebtoonLayout(storyId, scene.pageNumber)
      onRetryRequested(scene.sceneId, result.jobId as unknown as string)
      // 잡은 방금 큐에 들어갔을 뿐 — 결과 envelope 가 도착해 sentence.bubbleSlot 이 채워지면
      // 사용자가 페이지 새로고침해서 확인. 여기선 단순 토글만 처리.
      setRetryStatus('idle')
    } catch {
      setRetryStatus('failed')
    }
  }

  return (
    <article className="swt-page" aria-label={`Page ${scene.pageNumber}`}>
      <header className="swt-page-header">
        <span className="swt-page-num">Page {scene.pageNumber}</span>
        <div className="swt-page-actions">
          <button
            type="button"
            className={`swt-action-btn${isPlayingThisPage ? ' is-active' : ''}`}
            onClick={() => onTogglePlay(scene)}
            aria-label={isPlayingThisPage ? '페이지 재생 중지' : '페이지 재생'}
          >
            {isPlayingThisPage ? (
              <>
                <Pause className="w-3 h-3" /> 정지
              </>
            ) : (
              <>
                <Play className="w-3 h-3" /> 재생
              </>
            )}
          </button>
        </div>
      </header>

      <div className="swt-canvas">
        {scene.illustrationUrl ? (
          <img src={scene.illustrationUrl} alt={`Page ${scene.pageNumber} 삽화`} />
        ) : (
          <div className="swt-canvas-empty">
            <ImageIcon className="w-8 h-8" strokeWidth={1.5} />
          </div>
        )}

        {scene.sentences.map(sentence => {
          const position = sentence.bubbleSlot ?? FALLBACK_ANCHOR
          return (
            <WebtoonBubble
              key={sentence.sentenceId}
              sentence={sentence}
              position={position}
              isActive={activeSentenceId === sentence.sentenceId}
              showKorean={showKorean}
            />
          )
        })}
      </div>

      {hasMissingAnchor && isOwner && (
        <div
          className={`swt-retry-banner${retryStatus === 'pending' ? ' is-busy' : ''}`}
          role="alert"
        >
          <span>
            {retryStatus === 'failed'
              ? '재시도 요청에 실패했어요. 잠시 후 다시 시도해주세요.'
              : '말풍선 위치를 못 찾은 문장이 있어요. 좌표를 다시 뽑아볼까요?'}
          </span>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retryStatus === 'pending'}
          >
            <RefreshCw className="w-3 h-3" />{' '}
            {retryStatus === 'pending' ? '요청 중…' : '좌표 다시 추출'}
          </button>
        </div>
      )}
    </article>
  )
}
