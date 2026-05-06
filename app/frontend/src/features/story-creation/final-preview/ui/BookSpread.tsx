import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageOff, Pause, Play, Volume2 } from 'lucide-react'
import type { SceneDto } from '../../highlight-outro/api/highlightOutroApi'

interface BookSpreadProps {
  scene: SceneDto
  /** 0-based scene index. Visible book page numbers are idx*2+1 / idx*2+2. */
  pageIndex: number
}

/**
 * Final preview paper-craft book spread.
 * - Left: final illustration
 * - Right: page label, story text, translated text, and TTS controls
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

      <div className="cr-spread-page cr-spread-page-right">
        <span className="cr-spread-eyebrow">Page {scene.pageNumber}</span>
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
