import { useMemo, useState } from 'react'
import { ArrowLeft, Languages } from 'lucide-react'
import type { StoryView } from '../../model/types'
import { useWebtoonAudio } from '../model/useWebtoonAudio'
import { WebtoonPageView } from './WebtoonPageView'
import '../styles/story-webtoon.css'

interface StoryWebtoonViewerProps {
  story: StoryView
  isOwner: boolean
  onExit: () => void
}

/**
 * 웹툰 모드 전용 뷰어 — 책 모드 (StoryBookViewer) 와 형제 컴포넌트.
 *
 * 레이아웃:
 *  - 세로 스크롤 피드 — 페이지 = 1장의 일러스트 + 말풍선/캡션 오버레이.
 *  - 페이지마다 [재생] 버튼 → useWebtoonAudio 가 sentence 순차 재생, 활성 sentence 강조.
 *  - sentence.bubbleSlot 이 null 인 페이지는 본인 동화일 때 [좌표 다시 추출] 배너 노출.
 *
 * 뷰어 진입은 ViewerPage 의 popup window 에서 ?mode=webtoon 로 호출.
 */
export function StoryWebtoonViewer({ story, isOwner, onExit }: StoryWebtoonViewerProps) {
  const audio = useWebtoonAudio()
  const [showKorean, setShowKorean] = useState(false)

  // BE 는 page_number=0(표지) 도 scenes 에 포함시키지만 웹툰 뷰어는 본문 페이지만 표시.
  // story-book 모드와 동일한 정책 — 표지는 청첩장 카드가 이미 보여줌.
  const contentScenes = useMemo(
    () => story.scenes.filter(s => s.pageNumber > 0),
    [story.scenes],
  )

  if (contentScenes.length === 0) {
    return (
      <div className="swt-shell">
        <div className="swt-status">표시할 페이지가 없어요.</div>
      </div>
    )
  }

  return (
    <div className="swt-shell">
      <div className="swt-toolbar">
        <button
          type="button"
          className="swt-toolbar-btn"
          onClick={() => {
            audio.stop()
            onExit()
          }}
          aria-label="뷰어 닫기"
        >
          <ArrowLeft className="w-4 h-4" /> 닫기
        </button>
        <h1 className="swt-toolbar-title">{story.title ?? '제목 없는 동화'}</h1>
        <button
          type="button"
          className={`swt-toolbar-btn${showKorean ? ' is-active' : ''}`}
          onClick={() => setShowKorean(v => !v)}
          aria-pressed={showKorean}
        >
          <Languages className="w-4 h-4" /> 한글
        </button>
      </div>

      <div className="swt-feed">
        {contentScenes.map(scene => (
          <WebtoonPageView
            key={scene.sceneId}
            storyId={story.storyId}
            scene={scene}
            isOwner={isOwner}
            showKorean={showKorean}
            isPlayingThisPage={
              audio.isPlaying && audio.activeSceneId === scene.sceneId
            }
            activeSentenceId={audio.activeSentenceId}
            onTogglePlay={audio.playPage}
            onRetryRequested={() => {
              /* polling/refresh 는 후속 lane — 현재는 사용자가 새로고침으로 결과 확인. */
            }}
          />
        ))}
      </div>
    </div>
  )
}
