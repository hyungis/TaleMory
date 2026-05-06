import { useEffect, useRef, useState } from 'react'
import type { VoiceProfile } from '../../../../entities/voice-profile'

interface Props {
  voiceProfiles: VoiceProfile[]
  onAddClick: () => void
  onEditClick?: (profile: VoiceProfile) => void
  onDeleteClick?: (profile: VoiceProfile) => void
  isLoading?: boolean
  isBusy?: boolean
}

/**
 * 목소리 보관함 섹션 — paper-craft 톤.
 * Claude HTML 의 voice-card 디자인을 1:1 적용 — cream pill audio bar + 손그림 track.
 */
export function VoiceProfilesSection({
  voiceProfiles,
  onAddClick,
  onEditClick,
  onDeleteClick,
  isLoading = false,
  isBusy = false,
}: Props) {
  return (
    <section className="mp-card">
      <span className="mp-tape mp-tape--alt2" aria-hidden="true" />
      <header className="mp-card-header">
        <div>
          <h2 className="mp-card-title">목소리 보관함</h2>
          <div className="mp-card-sub">저장한 녹음과 TTS 샘플을 다시 들어볼 수 있어요.</div>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          disabled={isBusy}
          className="mp-btn mp-btn-sage"
        >
          + 목소리 추가
        </button>
      </header>

      {isLoading ? (
        <p className="mp-muted">목소리 목록을 불러오는 중이에요.</p>
      ) : voiceProfiles.length === 0 ? (
        <p className="mp-muted mp-muted--italic">아직 저장된 목소리가 없어요.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {voiceProfiles.map(profile => (
            <VoiceProfileCard
              key={profile.id}
              profile={profile}
              onEdit={onEditClick}
              onDelete={onDeleteClick}
              isBusy={isBusy}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function VoiceProfileCard({
  profile,
  onEdit,
  onDelete,
  isBusy,
}: {
  profile: VoiceProfile
  onEdit?: (profile: VoiceProfile) => void
  onDelete?: (profile: VoiceProfile) => void
  isBusy: boolean
}) {
  const previewUrl = profile.ttsVoiceUrl ?? profile.audioUrl
  const hasPreview = typeof previewUrl === 'string' && previewUrl.length > 0

  return (
    <li className="mp-voice-card">
      <div className="mp-voice-head">
        <div className="mp-voice-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="3" width="6" height="12" rx="3" stroke="#fdf6dc" strokeWidth="2" />
            <path
              d="M5,11 C5,15 8,18 12,18 C16,18 19,15 19,11 M12,18 L12,21 M9,21 L15,21"
              stroke="#fdf6dc"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="mp-voice-name">{profile.title}</div>
          <div className="mp-voice-sub">
            {profile.ttsVoiceUrl ? 'TTS 미리듣기 가능' : '원본 녹음본'}
          </div>
        </div>
        <div className="mp-char-actions">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(profile)}
              disabled={isBusy}
              className="mp-icon-action"
            >
              수정
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(profile)}
              disabled={isBusy}
              className="mp-icon-action danger"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {hasPreview ? (
        <PaperAudioPlayer src={previewUrl} />
      ) : (
        <p className="mp-empty-audio">아직 재생 가능한 오디오가 연결되지 않았어요.</p>
      )}
    </li>
  )
}

/* ============================================================================
 * PaperAudioPlayer — Claude HTML 의 audio-bar 1:1 (cream pill + sage play
 * + 손그림 track + Gaegu time + decorative volume/menu).
 * ========================================================================= */
function PaperAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const volumeWrapRef = useRef<HTMLSpanElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [errored, setErrored] = useState(false)
  const [volume, setVolume] = useState(1) // 0..1
  const [muted, setMuted] = useState(false)
  const [volumeOpen, setVolumeOpen] = useState(false)

  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setErrored(false)
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
    const audio = audioRef.current
    if (audio) audio.volume = volume
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.muted = muted
  }, [muted])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio || errored) return
    if (audio.paused) {
      void audio.play()
    } else {
      audio.pause()
    }
  }

  const seekFromClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const track = trackRef.current
    if (!audio || !track || !duration) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrentTime(audio.currentTime)
  }

  const progressPercent =
    duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={event => {
          const dur = event.currentTarget.duration
          setDuration(Number.isFinite(dur) ? dur : 0)
        }}
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setErrored(true)}
        style={{ display: 'none' }}
      />
      <div className="mp-audio-bar" role="group" aria-label="오디오 플레이어">
        <button
          type="button"
          onClick={togglePlay}
          disabled={errored}
          aria-label={isPlaying ? '일시정지' : '재생'}
          className="mp-audio-play"
        >
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
        <span className="mp-audio-time">{formatTime(currentTime)}</span>
        <div
          ref={trackRef}
          className="mp-audio-track"
          onClick={seekFromClick}
          role="slider"
          aria-label="재생 위치"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, Math.round(duration))}
          aria-valuenow={Math.round(currentTime)}
        >
          <div className="mp-audio-track-fill" style={{ width: `${progressPercent}%` }} />
          <div className="mp-audio-track-knob" style={{ left: `${progressPercent}%` }} />
        </div>
        <span className="mp-audio-time">{formatTime(duration)}</span>
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
      {errored && (
        <p
          style={{
            fontFamily: 'Gaegu, cursive',
            fontSize: 14,
            color: '#a37548',
            fontStyle: 'italic',
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          오디오를 재생할 수 없어요. 저장된 파일 주소를 다시 확인해 주세요.
        </p>
      )}
    </>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/* ============================================================================
 * VolumeButton — 클릭 시 슬라이더 popover 토글. 음소거나 0일 때 다른 SVG.
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

/* ============================================================================
 * VolumePopover — 슬라이더 + mute toggle. 0..1 → 0..100 변환.
 * ========================================================================= */
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
