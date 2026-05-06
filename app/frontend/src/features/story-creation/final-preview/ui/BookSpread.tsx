import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageOff, Pause, Play, Volume2 } from 'lucide-react'
import type { SceneDto } from '../../highlight-outro/api/highlightOutroApi'

interface BookSpreadProps {
  scene: SceneDto
  /** 0-based 페이지 인덱스. 표시용 페이지 번호는 idx*2+1 / idx*2+2. */
  pageIndex: number
}

/**
 * 펼쳐진 동화책 1 스프레드(좌/우 2페이지) — paper-craft 톤.
 * - 왼쪽: 실제 삽화 이미지 (illustrationUrl)
 * - 오른쪽: Page 라벨 + 영문/한글 본문 + TTS 미니 플레이어
 *
 * 클래스 정의는 `creation-paper.css` 의 Step 8 섹션 (`.cr-spread-*`, `.cr-tts-player`).
 */
export function BookSpread({ scene, pageIndex }: BookSpreadProps) {
  const englishText = scene.sentences.map(s => s.englishText).join(' ')
  const koreanText = scene.sentences
    .map(s => s.koreanText ?? '')
    .filter(Boolean)
    .join(' ')
  const ttsUrl = scene.sentences[0]?.ttsAudioUrl ?? null

  return (
    <div className="cr-spread">
      <div className="cr-spread-spine" aria-hidden="true" />

      {/* 좌측 — 일러스트 */}
      <div className="cr-spread-page cr-spread-page-left">
        <div className="cr-spread-illust">
          {scene.illustrationUrl ? (
            <img src={scene.illustrationUrl} alt={`Page ${scene.pageNumber} 삽화`} />
          ) : (
            <div className="cr-spread-illust-empty">
              <ImageOff className="w-12 h-12" strokeWidth={1.5} />
              <p>삽화 생성 중...</p>
            </div>
          )}
        </div>
        <span className="cr-spread-page-num">{pageIndex * 2 + 1}</span>
      </div>

      {/* 우측 — 본문 + TTS */}
      <div className="cr-spread-page cr-spread-page-right">
        <span className="cr-spread-eyebrow">Page {scene.pageNumber}</span>
        <h3 className="cr-spread-title">장면 {scene.pageNumber}</h3>
        <p className="cr-spread-english">{englishText}</p>
        {koreanText && <p className="cr-spread-korean">{koreanText}</p>}

        <div className="cr-spread-tts">
          {ttsUrl ? <TtsPlayer src={ttsUrl} /> : <TtsPlayerDisabled />}
        </div>
        <span className="cr-spread-page-num">{pageIndex * 2 + 2}</span>
      </div>
    </div>
  )
}

function TtsPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  // 다른 페이지로 넘기거나 src 가 바뀌면 즉시 정지
  useEffect(() => {
    audioRef.current?.pause()
    setPlaying(false)
  }, [src])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else audio.play().catch(() => {})
    setPlaying(!playing)
  }, [playing])

  return (
    <div className="cr-tts-player">
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} preload="none" />
      <button
        type="button"
        aria-label={playing ? '정지' : '재생'}
        onClick={toggle}
        className="cr-tts-player-btn"
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" style={{ marginLeft: 2 }} />}
      </button>
      <span className="cr-tts-player-label">
        <Volume2 className="w-4 h-4" />
        영문 읽어주기
      </span>
    </div>
  )
}

function TtsPlayerDisabled() {
  return (
    <div className="cr-tts-player is-disabled" aria-disabled="true">
      <span className="cr-tts-player-btn">
        <Play className="w-4 h-4" style={{ marginLeft: 2 }} />
      </span>
      <span className="cr-tts-player-label">음성 없음</span>
    </div>
  )
}
