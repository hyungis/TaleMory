import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImageOff, MessageCircle, MessageSquareText, Pause, Play, SkipForward, Volume2 } from 'lucide-react'
import type { SceneDto, SentenceDto } from '../../highlight-outro/api/highlightOutroApi'

interface BookSpreadProps {
  scene: SceneDto
  /** 0-based scene index. Visible book page numbers are idx*2+1 / idx*2+2. */
  pageIndex: number
}

/**
 * Final preview paper-craft book spread.
 *
 * - Left: final illustration
 * - Right (VIEWER): joined english + korean + page-level TTS player
 * - Right (WEBTOON): per-sentence dialogue cards with speaker chip + per-sentence TTS +
 *   page-level sequential play button.
 *
 * WEBTOON 모드 자동 추론:
 *   sentences 중 speakerKey 가 채워져있고 'narrator' 가 아닌 게 하나라도 있으면 WEBTOON 으로 본다.
 *   (BE 가 storyMode 를 SentenceDto 에 노출하지 않아도 안전 — VIEWER 응답은 모든 speakerKey=null.)
 */
export function BookSpread({ scene, pageIndex }: BookSpreadProps) {
  const isWebtoon = useMemo(
    () => scene.sentences.some(s => s.speakerKey != null && s.speakerKey !== 'narrator'),
    [scene.sentences],
  )

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

        {isWebtoon ? (
          <WebtoonRightPage scene={scene} />
        ) : (
          <ViewerRightPage scene={scene} />
        )}

        <span className="cr-spread-page-num">{pageIndex * 2 + 2}</span>
      </div>
    </div>
  )
}

// ─── VIEWER 모드 (기존 동작 보존) ──────────────────────────────────────

function ViewerRightPage({ scene }: { scene: SceneDto }) {
  const englishText = scene.sentences.map(s => s.englishText).join(' ')
  const koreanText = scene.sentences
    .map(s => s.koreanText ?? '')
    .filter(Boolean)
    .join(' ')
  const ttsUrl = scene.sentences[0]?.ttsAudioUrl ?? null

  return (
    <>
      <p
        className="cr-spread-english"
        style={{
          fontFamily: 'var(--cr-font-gaegu)',
          fontSize: '24px',
          fontWeight: 500,
          lineHeight: 1.625,
          color: '#3E2A18',
          letterSpacing: 'normal',
        }}
      >
        {englishText}
      </p>
      {koreanText && (
        <p
          className="cr-spread-korean"
          style={{
            fontFamily: 'var(--cr-font-gaegu)',
            fontSize: '20px',
            fontWeight: 700,
            lineHeight: 1.625,
            color: '#6B4A28',
            letterSpacing: 'normal',
          }}
        >
          {koreanText}
        </p>
      )}

      <div className="cr-spread-tts">
        {ttsUrl ? <TtsPlayer src={ttsUrl} /> : <TtsPlayerDisabled />}
      </div>
    </>
  )
}

// ─── WEBTOON 모드 — sentence 별 dialogue 카드 + 순차 재생 ────────────────

function WebtoonRightPage({ scene }: { scene: SceneDto }) {
  // 각 sentence 별 audio ref. 페이지 변경 / sentence 카드 추가/삭제에 따라 동기화.
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([])

  // 현재 재생 중인 sentence index. null = 정지.
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  // 페이지 전체 sequential play 모드 (true 면 onEnded 가 다음 sentence 자동 진행).
  const [isSequential, setIsSequential] = useState(false)

  // 페이지 변경 시 모든 audio 정지 + state reset.
  useEffect(() => {
    return () => {
      audioRefs.current.forEach(a => {
        if (a) {
          a.pause()
          a.currentTime = 0
        }
      })
    }
  }, [scene.id])

  const stopAll = useCallback(() => {
    audioRefs.current.forEach(a => {
      if (a) {
        a.pause()
        a.currentTime = 0
      }
    })
    setActiveIndex(null)
    setIsSequential(false)
  }, [])

  const playOne = useCallback((index: number) => {
    // 다른 sentence 가 재생 중이면 정지.
    audioRefs.current.forEach((a, i) => {
      if (a && i !== index) {
        a.pause()
        a.currentTime = 0
      }
    })
    const target = audioRefs.current[index]
    if (!target) return
    target.play().catch(() => {})
    setActiveIndex(index)
  }, [])

  const toggleOne = useCallback((index: number) => {
    if (activeIndex === index) {
      audioRefs.current[index]?.pause()
      setActiveIndex(null)
      setIsSequential(false)
    } else {
      setIsSequential(false)
      playOne(index)
    }
  }, [activeIndex, playOne])

  const startSequential = useCallback(() => {
    setIsSequential(true)
    playOne(0)
  }, [playOne])

  const handleEnded = useCallback((index: number) => {
    if (!isSequential) {
      setActiveIndex(null)
      return
    }
    const next = index + 1
    if (next >= scene.sentences.length) {
      setActiveIndex(null)
      setIsSequential(false)
      return
    }
    playOne(next)
  }, [isSequential, playOne, scene.sentences.length])

  const hasAnyTts = scene.sentences.some(s => s.ttsAudioUrl)
  const isAnyPlaying = activeIndex !== null

  return (
    <div className="cr-spread-webtoon">
      {/* 페이지 전체 재생 (순차) */}
      {hasAnyTts && (
        <div className="cr-spread-page-play-bar">
          <button
            type="button"
            className={`cr-spread-page-play${isSequential ? ' is-active' : ''}`}
            onClick={isSequential ? stopAll : startSequential}
            aria-label={isSequential ? '페이지 재생 중지' : '페이지 전체 재생'}
          >
            {isSequential ? (
              <>
                <Pause className="w-3.5 h-3.5" /> 정지
              </>
            ) : (
              <>
                <SkipForward className="w-3.5 h-3.5" /> 페이지 전체 재생
              </>
            )}
          </button>
          {isAnyPlaying && !isSequential && (
            <button
              type="button"
              className="cr-spread-page-stop"
              onClick={stopAll}
              aria-label="음성 정지"
            >
              정지
            </button>
          )}
        </div>
      )}

      <div className="cr-spread-webtoon-list">
        {scene.sentences.map((sentence, index) => {
          const isNarration = !sentence.speakerKey || sentence.speakerKey === 'narrator'
          const isActive = activeIndex === index
          return (
            <DialogueCard
              key={sentence.id}
              sentence={sentence}
              index={index}
              isNarration={isNarration}
              isActive={isActive}
              onToggle={() => toggleOne(index)}
              onEnded={() => handleEnded(index)}
              audioRef={el => (audioRefs.current[index] = el)}
            />
          )
        })}
      </div>
    </div>
  )
}

interface DialogueCardProps {
  sentence: SentenceDto
  index: number
  isNarration: boolean
  isActive: boolean
  onToggle: () => void
  onEnded: () => void
  audioRef: (el: HTMLAudioElement | null) => void
}

function DialogueCard({
  sentence,
  index,
  isNarration,
  isActive,
  onToggle,
  onEnded,
  audioRef,
}: DialogueCardProps) {
  const speakerLabel = isNarration ? '나레이션' : sentence.speakerKey ?? '?'
  // narrator 는 항상 같은 톤. character 는 speakerKey hash → palette index 결정 (deterministic).
  const colorIndex = isNarration ? -1 : speakerColorIndex(sentence.speakerKey ?? '')

  return (
    <div
      className={[
        'cr-spread-webtoon-card',
        isNarration ? 'is-narration' : 'is-dialogue',
        isActive ? 'is-active' : '',
      ].join(' ').trim()}
      data-speaker-color={colorIndex}
    >
      <div className="cr-spread-card-head">
        <span className="cr-spread-speaker-chip">
          {isNarration ? (
            <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {speakerLabel}
        </span>
        {sentence.ttsAudioUrl ? (
          <button
            type="button"
            className={`cr-spread-mini-tts${isActive ? ' is-active' : ''}`}
            onClick={onToggle}
            aria-label={isActive ? `문장 ${index + 1} 정지` : `문장 ${index + 1} 재생`}
          >
            {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span
            className="cr-spread-mini-tts is-disabled"
            aria-disabled="true"
            title="음성 없음"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      <p className={`cr-spread-card-en${isNarration ? ' is-narration' : ''}`}>
        {sentence.englishText}
      </p>
      {sentence.koreanText && (
        <p className={`cr-spread-card-ko${isNarration ? ' is-narration' : ''}`}>
          {sentence.koreanText}
        </p>
      )}
      {sentence.ttsAudioUrl && (
        <audio
          ref={audioRef}
          src={sentence.ttsAudioUrl}
          onEnded={onEnded}
          preload="none"
        />
      )}
    </div>
  )
}

// ─── 캐릭터 chip 색상 결정 ─────────────────────────────────────────────

const SPEAKER_PALETTE_SIZE = 6

/**
 * speakerKey 의 djb2-style hash → palette[0..SPEAKER_PALETTE_SIZE-1].
 * 같은 캐릭터는 항상 같은 색. CSS 의 `.cr-spread-webtoon-card[data-speaker-color="N"]` 로 매핑.
 */
function speakerColorIndex(speakerKey: string): number {
  let h = 5381
  for (let i = 0; i < speakerKey.length; i++) {
    h = ((h << 5) + h + speakerKey.charCodeAt(i)) | 0
  }
  return Math.abs(h) % SPEAKER_PALETTE_SIZE
}

// ─── VIEWER 모드 페이지 통합 TTS player (기존 컴포넌트 그대로) ─────────

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
