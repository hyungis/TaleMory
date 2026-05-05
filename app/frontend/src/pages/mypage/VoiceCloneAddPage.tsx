import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../../shared/constants'
import { BookshelfDoodles } from '../../features/bookshelf'
import {
  VOICE_SAMPLE_SCRIPT,
  useVoiceClone,
  formatAudioTime,
} from '../../features/mypage'
import './styles/mypage.css'

/**
 * 마이페이지 → "+ 목소리 추가" 전용 페이지 (`/mypage/voice-clone`).
 *
 * 디자인:
 *  - 페이지 상단 sticky vc-page-bar (마이페이지 back 버튼)
 *  - vc-hero — sage 78x78 mic + Nanum Pen Script 52px 타이틀
 *  - 녹음 카드 — 손그림 인용구 카드 + recorder (3-state: idle/recording/recorded)
 *      pulse-ring + waveform (28 bar) + Nanum Myeongjo 시간
 *  - 저장 카드 — 보이스 이름 + 저장
 *  - vc-foot-mark — Nanum Pen Script 손글씨 푸터
 *
 * 단계 (stepper / TTS 미리듣기) 는 제거하고 한 페이지에서 녹음 → 저장만 처리한다.
 * 백엔드 로직(useVoiceClone)은 그대로 유지하며 UI 만 reskin.
 */
export function VoiceCloneAddPage() {
  const navigate = useNavigate()
  const vc = useVoiceClone()

  // 샘플 문장 — 한 문장 기준.
  const sample = useMemo(() => buildSample(VOICE_SAMPLE_SCRIPT), [])

  // 녹음 단계 phase 계산 — useVoiceClone 의 status 를 idle/recording/recorded 로 매핑.
  const phase: Phase =
    vc.status === 'recording'
      ? 'recording'
      : vc.status === 'ready'
        ? 'recorded'
        : 'idle'

  // 녹음 경과 시간 — vc.audioCurrentTime 은 "재생" 시간이라 녹음 중에는 0 유지.
  // 녹음 시작 시 1초 간격으로 증가, 종료 시 리셋(다음 녹음 위해).
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  useEffect(() => {
    if (phase !== 'recording') {
      // 녹음 종료 (recorded) 시점에는 마지막 값을 유지하고, idle 로 돌아가면 0 으로 리셋.
      if (phase === 'idle') setRecordingSeconds(0)
      return
    }
    setRecordingSeconds(0)
    const interval = window.setInterval(() => {
      setRecordingSeconds(prev => prev + 1)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [phase])

  const goBack = () => navigate(ROUTES.mypage)

  const handleSave = async () => {
    const name = await vc.saveVoiceRecording()
    if (name) goBack()
  }

  const handleRecordButton = () => {
    if (vc.status === 'recording') {
      vc.stopRecording()
    } else {
      void vc.startRecording()
    }
  }

  const progressPercent =
    vc.audioDuration > 0 ? (vc.audioCurrentTime / vc.audioDuration) * 100 : 0

  return (
    <div className="mypage-shell">
      <div className="mp-doodles-bg" aria-hidden="true">
        <BookshelfDoodles />
      </div>

      {/* ── 상단 바 — back 버튼만 ─────────── */}
      <div className="vc-page-bar">
        <button type="button" onClick={goBack} className="vc-back-btn" aria-label="마이페이지로">
          <svg width="12" height="10" viewBox="0 0 14 10" aria-hidden="true">
            <path
              d="M5,2 L1,5 L5,8 M1,5 L13,5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          마이페이지
        </button>
        <div style={{ width: 100 }} aria-hidden="true" />
      </div>

      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '0 24px 60px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* ── Hero ───────────────────────────────────────── */}
        <div className="vc-hero">
          <div className="vc-hero-mic" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="3" width="6" height="12" rx="3" stroke="#fdf6dc" strokeWidth="2" />
              <path
                d="M5,11 C5,15 8,18 12,18 C16,18 19,15 19,11 M12,18 L12,21 M9,21 L15,21"
                stroke="#fdf6dc"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1>새 목소리를 들려주세요</h1>
          <p>
            아래 샘플 문장을 또박또박 따라 읽어주시면,
            <br />
            아이가 사랑하는 그 목소리로 동화를 들려드릴게요.
          </p>
        </div>

        {/* ── 녹음 카드 ─────────────────────────────────── */}
        <div className="mp-card" style={{ marginTop: 18 }}>
          <span className="mp-tape" aria-hidden="true" />
          <div
            className="mp-card-header"
            style={{ marginBottom: 6, alignItems: 'center' }}
          >
            <h2 className="mp-card-title" style={{ margin: 0 }}>
              오늘의 문장
            </h2>
          </div>

          <div className="vc-sample-block">
            <div className="quote-mark" aria-hidden="true">
              "
            </div>
            <div className="quote">{sample.en}</div>
            {sample.ko && <div className="ko-hint">{sample.ko}</div>}
            <div className="vc-sample-meta">
              <span className="vc-lang">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" stroke="#5b3a18" strokeWidth="1.6" fill="none" />
                  <path
                    d="M2,8 L14,8 M8,2 Q11,8 8,14 Q5,8 8,2"
                    stroke="#5b3a18"
                    strokeWidth="1.4"
                    fill="none"
                  />
                </svg>
                영어 (US)
              </span>
              <span className="vc-tip">조용한 곳에서 약 10초 정도 읽어주세요</span>
            </div>
          </div>

          <Recorder
            phase={phase}
            statusLabel={vc.statusLabel}
            recordingSeconds={recordingSeconds}
            duration={vc.audioDuration}
            onMicClick={handleRecordButton}
            onStop={() => vc.stopRecording()}
            onPlay={vc.toggleAudioPlayback}
            onRerecord={vc.rerecord}
            isPlaying={vc.isAudioPlaying}
            hasAudio={!!vc.recordedAudioUrl}
          />

          {/* 숨김 audio 태그 — useVoiceClone 의 audioRef 와 연결 */}
          <audio
            ref={vc.audioRef}
            src={vc.recordedAudioUrl ?? undefined}
            preload="metadata"
            style={{ display: 'none' }}
            onLoadedMetadata={e =>
              vc.setAudioDuration((e.currentTarget.duration as number | undefined) ?? 0)
            }
            onTimeUpdate={e => vc.setAudioCurrentTime(e.currentTarget.currentTime ?? 0)}
            onPlay={() => vc.setIsAudioPlaying(true)}
            onPause={() => vc.setIsAudioPlaying(false)}
            onEnded={() => vc.setIsAudioPlaying(false)}
          />

          {/* 녹음 완료 후 미리듣기 */}
          {phase === 'recorded' && vc.recordedAudioUrl && (
            <div className="vc-preview-audio">
              <div className="vc-preview-audio-head">
                <span>녹음 미리듣기</span>
                <span className="vc-tip">{formatAudioTime(vc.audioDuration)}</span>
              </div>
              <PaperAudioStrip
                isPlaying={vc.isAudioPlaying}
                onToggle={vc.toggleAudioPlayback}
                onSeek={vc.seekAudio}
                progressPercent={progressPercent}
                currentLabel={formatAudioTime(vc.audioCurrentTime)}
                durationLabel={formatAudioTime(vc.audioDuration)}
                audioRef={vc.audioRef}
                src={vc.recordedAudioUrl}
              />
            </div>
          )}
        </div>

        {/* ── 저장 카드 ─────────────────────────────── */}
        <div className={`mp-card${phase !== 'recorded' ? ' vc-card-dim has-actions' : ''}`}>
          <span className="mp-tape mp-tape--alt2" aria-hidden="true" />
          <h2 className="mp-card-title" style={{ marginTop: 2, marginBottom: 14 }}>
            이 목소리를 뭐라고 부를까요?
          </h2>

          <p
            style={{
              fontFamily: 'Gaegu, cursive',
              fontSize: 15,
              color: 'var(--mp-ink-soft)',
              margin: '0 0 12px',
            }}
          >
            {phase === 'recorded'
              ? '녹음이 완료되었어요. 보이스에 이름을 지어 저장해 주세요.'
              : '먼저 위에서 녹음을 완료해 주세요.'}
          </p>

          <div style={inputLabelStyle}>보이스 이름</div>
          <div className="vc-save-row">
            <input
              type="text"
              className="vc-save-input"
              placeholder="예) 엄마 따뜻한 목소리, 아빠 잠자리 보이스"
              value={vc.voiceTitle}
              onChange={e => vc.setVoiceTitle(e.target.value)}
              disabled={phase !== 'recorded'}
            />
            <button
              type="button"
              className="mp-btn mp-btn-sage"
              disabled={phase !== 'recorded' || !vc.voiceTitle.trim() || vc.isSaving}
              onClick={() => void handleSave()}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3,3 L11,3 L13,5 L13,13 L3,13 Z M5,3 L5,7 L11,7 L11,3 M5,10 L11,10"
                  stroke="#fdf6dc"
                  strokeWidth="1.8"
                  fill="none"
                />
              </svg>
              {vc.isSaving ? '저장 중...' : '저장하고 돌아가기'}
            </button>
          </div>
        </div>

        <div className="vc-foot-mark">
          — 저장하지 않은 녹음은 페이지를 떠나면 사라져요 <span className="heart">♥</span> —
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
 * Recorder — 3-state (idle/recording/recorded) + pulse-ring + waveform + time
 * ========================================================================= */
type Phase = 'idle' | 'recording' | 'recorded'

interface RecorderProps {
  phase: Phase
  statusLabel: string
  /** 녹음 중 경과 초 — 1초 간격 카운트업. */
  recordingSeconds: number
  /** 녹음 완료 후 audio.duration. */
  duration: number
  hasAudio: boolean
  isPlaying: boolean
  onMicClick: () => void
  onStop: () => void
  onPlay: () => void
  onRerecord: () => void
}

function Recorder({
  phase,
  statusLabel,
  recordingSeconds,
  duration,
  hasAudio,
  isPlaying,
  onMicClick,
  onStop,
  onPlay,
  onRerecord,
}: RecorderProps) {
  const stateClass =
    phase === 'recording'
      ? 'is-recording'
      : phase === 'recorded'
        ? 'is-recorded'
        : ''

  // recording 중에는 vc.audioCurrentTime 이 0 유지되므로 별도 카운터 사용.
  // recorded 시 duration 이 알 수 없으면 (Blob 직후엔 NaN/Infinity 일 수 있음)
  // 마지막 카운터 값을 fallback 으로 사용.
  const recordedTime =
    duration > 0 && Number.isFinite(duration) ? duration : recordingSeconds
  const timeText =
    phase === 'recording'
      ? formatAudioTime(recordingSeconds)
      : phase === 'recorded'
        ? formatAudioTime(recordedTime)
        : '00:00'

  return (
    <div className={`vc-recorder ${stateClass}`}>
      <div className="vc-rec-status-tag">
        {phase === 'recording' && (
          <>
            <span className="live-dot" /> REC · 녹음 중
          </>
        )}
        {phase === 'idle' && (statusLabel || '대기 중')}
        {phase === 'recorded' && '✓ 녹음이 완료되었어요'}
      </div>

      <div className="vc-rec-mic-shell">
        {phase === 'recording' && (
          <>
            <span className="pulse-ring" aria-hidden="true" />
            <span className="pulse-ring delay" aria-hidden="true" />
          </>
        )}
        <button
          type="button"
          className="vc-btn-record"
          onClick={onMicClick}
          aria-label={phase === 'recording' ? '녹음 종료' : '녹음 시작'}
        >
          {phase === 'recording' ? (
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <rect x="6" y="6" width="10" height="10" rx="2" fill="#fff" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="3" width="6" height="12" rx="3" fill="#fff" />
              <path
                d="M5,11 C5,15 8,18 12,18 C16,18 19,15 19,11 M12,18 L12,21"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      <div className="vc-rec-time">{timeText}</div>
      <Waveform active={phase === 'recording'} recorded={phase === 'recorded'} />

      <div className="vc-rec-hint">
        {phase === 'idle' && '버튼을 눌러 녹음을 시작하세요'}
        {phase === 'recording' && '또박또박 천천히 읽어주세요'}
        {phase === 'recorded' && '잘 들리는지 한 번 들어볼까요?'}
      </div>

      {phase === 'recording' && (
        <div className="vc-rec-actions">
          <button type="button" className="mp-btn mp-btn-sage" onClick={onStop}>
            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3" y="3" width="10" height="10" rx="1.5" fill="#fdf6dc" />
            </svg>
            녹음 종료
          </button>
        </div>
      )}
      {phase === 'recorded' && (
        <div className="vc-rec-actions">
          <button
            type="button"
            className="mp-btn mp-btn-cream"
            onClick={onPlay}
            disabled={!hasAudio}
          >
            {isPlaying ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2" y="2" width="3" height="8" fill="#5b3a18" />
                <rect x="7" y="2" width="3" height="8" fill="#5b3a18" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3,2 L3,10 L10,6 Z" fill="#5b3a18" />
              </svg>
            )}
            {isPlaying ? '일시정지' : '들어보기'}
          </button>
          <button type="button" className="mp-btn mp-btn-cream" onClick={onRerecord}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2,8 Q2,3 8,3 Q12,3 14,5 M14,3 L14,6 L11,6"
                stroke="#5b3a18"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            다시 녹음
          </button>
        </div>
      )}
    </div>
  )
}

/* ============================================================================
 * Waveform — 28 bar 모션 placeholder
 * ========================================================================= */
const WAVEFORM_HEIGHTS = [
  14, 22, 32, 18, 28, 40, 22, 36, 44, 28, 18, 30, 40, 24, 36, 28, 42, 20, 30, 38, 22, 34, 28, 44, 18, 26, 32, 20,
]

function Waveform({ active, recorded }: { active: boolean; recorded: boolean }) {
  return (
    <div className="vc-waveform" aria-hidden="true">
      {WAVEFORM_HEIGHTS.map((h, i) => {
        const style: CSSProperties & Record<string, string | number> = {
          '--h': `${h}px`,
          height: active ? `${h}px` : recorded ? `${h * 0.65}px` : '8px',
          animationDelay: `${i * 50}ms`,
        }
        return <div key={i} className="bar" style={style} />
      })}
    </div>
  )
}

/* ============================================================================
 * PaperAudioStrip — 녹음 미리듣기용 작은 audio bar.
 * audioRef 를 받아 volume / muted 를 직접 조작.
 * ========================================================================= */
function PaperAudioStrip({
  isPlaying,
  onToggle,
  onSeek,
  progressPercent,
  currentLabel,
  durationLabel,
  audioRef,
  src,
}: {
  isPlaying: boolean
  onToggle: () => void
  onSeek: (percent: number) => void
  progressPercent: number
  currentLabel: string
  durationLabel: string
  audioRef?: RefObject<HTMLAudioElement | null>
  src?: string | null
}) {
  const volumeWrapRef = useRef<HTMLSpanElement | null>(null)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [volumeOpen, setVolumeOpen] = useState(false)

  // src 가 바뀌면 reset
  useEffect(() => {
    setVolume(1)
    setMuted(false)
    setVolumeOpen(false)
  }, [src])

  // 외부 클릭 시 popover 닫기
  useEffect(() => {
    if (!volumeOpen) return
    const onDown = (event: MouseEvent) => {
      if (!volumeWrapRef.current?.contains(event.target as Node)) {
        setVolumeOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [volumeOpen])

  // audio 엘리먼트에 volume / muted 반영
  useEffect(() => {
    const audio = audioRef?.current
    if (audio) audio.volume = volume
  }, [audioRef, volume])

  useEffect(() => {
    const audio = audioRef?.current
    if (audio) audio.muted = muted
  }, [audioRef, muted])

  return (
    <div className="mp-audio-bar" role="group" aria-label="녹음 재생">
      <button type="button" className="mp-audio-play" onClick={onToggle} aria-label={isPlaying ? '일시정지' : '재생'}>
        {isPlaying ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="2" y="1" width="2.5" height="8" fill="#fdf6dc" />
            <rect x="5.5" y="1" width="2.5" height="8" fill="#fdf6dc" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2,1 L2,9 L9,5 Z" fill="#fdf6dc" />
          </svg>
        )}
      </button>
      <span className="mp-audio-time">{currentLabel}</span>
      <div
        className="mp-audio-track"
        onClick={event => {
          const rect = event.currentTarget.getBoundingClientRect()
          const percent = ((event.clientX - rect.left) / rect.width) * 100
          onSeek(Math.max(0, Math.min(100, percent)))
        }}
        role="slider"
        aria-label="재생 위치"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
      >
        <div className="mp-audio-track-fill" style={{ width: `${progressPercent}%` }} />
        <div className="mp-audio-track-knob" style={{ left: `${progressPercent}%` }} />
      </div>
      <span className="mp-audio-time">{durationLabel}</span>
      <span ref={volumeWrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <VolumeButton
          volume={volume}
          muted={muted}
          isOpen={volumeOpen}
          onToggle={() => setVolumeOpen(prev => !prev)}
        />
        {volumeOpen && (
          <VolumePopover
            volume={volume}
            muted={muted}
            onVolumeChange={next => {
              setVolume(next)
              if (next > 0 && muted) setMuted(false)
            }}
            onToggleMute={() => setMuted(prev => !prev)}
          />
        )}
      </span>
    </div>
  )
}

/* ============================================================================
 * VolumeButton & VolumePopover — 재사용을 위해 inline 정의.
 * VoiceProfilesSection 의 PaperAudioPlayer 와 동일한 구현.
 * ========================================================================= */
function VolumeButton({
  volume,
  muted,
  isOpen,
  onToggle,
}: {
  volume: number
  muted: boolean
  isOpen: boolean
  onToggle: () => void
}) {
  const isMute = muted || volume <= 0.001
  const isLow = !isMute && volume < 0.45
  return (
    <button
      type="button"
      className={`mp-audio-volume${isMute ? ' muted' : ''}`}
      onClick={onToggle}
      aria-label="볼륨 조절"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
    >
      {isMute ? (
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
          <path
            d="M2,5 L2,9 L6,9 L10,12 L10,2 L6,5 Z"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <line x1="12" y1="3" x2="17" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="17" y1="3" x2="12" y2="11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : isLow ? (
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
          <path
            d="M2,5 L2,9 L6,9 L10,12 L10,2 L6,5 Z"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path d="M13,4 Q15,7 13,10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
          <path
            d="M2,5 L2,9 L6,9 L10,12 L10,2 L6,5 Z M13,4 Q15,7 13,10 M15,2 Q18,7 15,12"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}

function VolumePopover({
  volume,
  muted,
  onVolumeChange,
  onToggleMute,
}: {
  volume: number
  muted: boolean
  onVolumeChange: (next: number) => void
  onToggleMute: () => void
}) {
  const displayed = muted ? 0 : Math.round(volume * 100)
  const sliderStyle = { '--mp-vol': `${displayed}%` } as Record<string, string>
  return (
    <div
      className="mp-volume-popover"
      role="dialog"
      aria-label="볼륨 조절"
      onClick={event => event.stopPropagation()}
    >
      <div className="mp-volume-popover-header">
        <span>볼륨</span>
        <strong>{displayed}</strong>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={displayed}
        onChange={event => onVolumeChange(Number(event.target.value) / 100)}
        className="mp-volume-slider"
        style={sliderStyle}
        aria-label="볼륨 슬라이더"
      />
      <button
        type="button"
        className={`mp-volume-mute-toggle${muted ? ' muted' : ''}`}
        onClick={onToggleMute}
      >
        {muted ? '음소거 해제' : '음소거'}
      </button>
    </div>
  )
}

/* ============================================================================
 * Helpers
 * ========================================================================= */

const inputLabelStyle: CSSProperties = {
  fontFamily: 'Gaegu, cursive',
  fontSize: 14,
  color: 'var(--mp-ink-soft)',
  marginBottom: 6,
  fontWeight: 700,
}

/** VOICE_SAMPLE_SCRIPT 가 한국어/영문 한 줄이라 그대로 영문 자리에 노출.
 *  KO hint 가 있으면 보여주고, 없으면 생략. */
function buildSample(script: string): { en: string; ko?: string } {
  const trimmed = script.trim()
  if (!trimmed) return { en: '"안녕, 우리 함께 이야기를 시작해 볼까?"' }
  // 따옴표가 없으면 자동으로 감싼다
  if (!trimmed.startsWith('"') && !trimmed.startsWith('"')) {
    return { en: `"${trimmed}"` }
  }
  return { en: trimmed }
}
