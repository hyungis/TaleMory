import { useMemo, useState } from 'react'
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

/** NARRATION sentence 또는 매칭 실패 시 fallback 좌표 — top-center. */
const FALLBACK_ANCHOR: AnchorPoint = { x: 0.5, y: 0.05 }

/**
 * 단일 페이지 뷰 — 이미지 + 말풍선 오버레이 + 페이지 액션 (재생 / 재시도).
 *
 * 좌표 lookup 흐름:
 *  - sentence.speakerKey == null (NARRATION)  → fallback (top center)
 *  - sentence.speakerKey 가 scene.characterAnchors[].name 에 있음 → 해당 anchor
 *  - sentence.speakerKey 매칭 실패 (DIALOGUE 인데 anchor 없음) → fallback + 재시도 배너 노출
 *
 * isOwner=true 인 경우만 재시도 배너 활성. 공개 공유 링크는 항상 숨김.
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
  // scene.characterAnchors[] → Map<name, AnchorPoint> 로 인덱싱 (sentence 마다 매번 find 안 하도록).
  const anchorByName = useMemo(() => {
    const map = new Map<string, AnchorPoint>()
    for (const a of scene.characterAnchors) {
      if (a.name && a.x != null && a.y != null) {
        map.set(a.name, { x: a.x, y: a.y })
      }
    }
    return map
  }, [scene.characterAnchors])

  // DIALOGUE 인데 anchor 매칭 실패한 sentence 가 하나라도 있으면 재시도 배너 노출.
  const hasMissingAnchor = useMemo(
    () => scene.sentences.some(s => s.speakerKey != null && !anchorByName.has(s.speakerKey)),
    [scene.sentences, anchorByName],
  )

  const [retryStatus, setRetryStatus] = useState<'idle' | 'pending' | 'failed'>('idle')

  const handleRetry = async () => {
    setRetryStatus('pending')
    try {
      const result = await retryWebtoonLayout(storyId, scene.pageNumber)
      onRetryRequested(scene.sceneId, result.jobId as unknown as string)
      // 잡은 방금 큐에 들어갔을 뿐 — 결과 envelope 가 도착해 scene.characterAnchors 가 채워지면
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
          // speakerKey 가 있으면 scene.characterAnchors 에서 lookup, 없으면(NARRATION) fallback.
          // 매칭 실패 (DIALOGUE 인데 anchor 없음) 도 fallback — 재시도 배너로 사용자에게 알림.
          const position = sentence.speakerKey
            ? (anchorByName.get(sentence.speakerKey) ?? FALLBACK_ANCHOR)
            : FALLBACK_ANCHOR
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
