import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  FolderOpen,
  Lock,
  Mic,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Volume2,
  Wand2,
} from 'lucide-react'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
import { StepTitleBlock } from '../../ui/StepTitleBlock'
import { formatAudioTime, useVoiceClone } from '../model/useVoiceClone'
import type { VoiceProfileDto } from '../api/voiceProfileApi'
import { VoiceSaveModal } from './VoiceSaveModal'
import { VoiceLoadModal } from './VoiceLoadModal'
import type { StoryId } from '../../../../shared/types'
import '../../styles/creation-paper.css'

interface VoiceCloneStepProps {
  storyId?: StoryId | null
  onBack: () => void
  onNext: () => void
  onVoiceSaved?: (voiceModel: string) => void
  /**
   * step 7 → 8 confirm 이후로 잠긴 상태. 녹음/저장/불러오기/TTS 등 모든 변경 액션을 막고
   * "다음" 버튼은 그대로 동작 (이미 이 단계는 통과한 상태이므로 다음 단계로 자유 이동).
   */
  readOnly?: boolean
}

/**
 * STEP 06 — paper-craft 톤 (Claude offline.html 1:1).
 * 3 섹션: 녹음 / TTS 미리듣기 / TTS 저장.
 * 모든 useVoiceClone 로직 그대로 유지.
 */
export function VoiceCloneStep({
  storyId,
  onBack,
  onNext,
  onVoiceSaved,
  readOnly = false,
}: VoiceCloneStepProps) {
  const vc = useVoiceClone(storyId)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)

  const StatusIcon =
    vc.status === 'recording' ? Mic : vc.status === 'ready' ? CheckCircle2 : Radio

  const statusClass =
    vc.status === 'recording'
      ? 'cr-vc-status recording'
      : vc.status === 'ready'
        ? 'cr-vc-status ready'
        : 'cr-vc-status'

  const progressPercent = vc.audioDuration > 0 ? (vc.audioCurrentTime / vc.audioDuration) * 100 : 0

  /**
   * 저장 모달의 onSubmit — 제목을 hook 으로 넘기고 성공 시 모달 닫음 + onVoiceSaved 콜백.
   * 실패(null 반환)면 모달은 열어둔 채로 두어 사용자가 재시도/제목 변경 가능.
   */
  const handleSaveSubmit = async (title: string) => {
    const name = await vc.saveVoiceRecording(title)
    if (name) {
      setShowSaveModal(false)
      if (onVoiceSaved) onVoiceSaved(name)
    }
  }

  /**
   * 불러오기 모달의 onSelect — 선택된 프로필을 hook 에 적용 후 모달 닫음.
   * onVoiceSaved 도 호출 — Step 7 진입 시 voiceModel 이 set 되어 있어야 다음 단계 가드 통과.
   */
  const handleProfileSelect = async (profile: VoiceProfileDto) => {
    await vc.loadVoiceProfile(profile)
    setShowLoadModal(false)
    if (onVoiceSaved) onVoiceSaved(profile.title)
  }

  return (
    <div className="cr-shell">
      <CreationDoodlesBg />
      <CreationHeader currentStep={6} />

      <div className="cr-scroll">
        <main className="cr-shell-inner cr-fade-in">
          <StepTitleBlock
            stepNumber={6}
            title="부모 목소리를 들려주세요"
            subtitle="샘플 문장을 따라 읽고 녹음을 저장하면, 부모님 목소리로 동화를 읽어줄 수 있어요"
          />

          {/* 락 안내 — step 1/2/3/5 와 동일한 노란 cr-banner 톤. */}
          {readOnly && (
            <div className="cr-banner" role="status">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <strong>보이스가 확정되어 이 단계는 읽기 전용이에요.</strong>
                <span style={{ fontSize: 18, opacity: 0.9 }}>
                  보이스를 바꾸려면 새 동화책을 만들어주세요. 다음 단계로 넘어가면 최종 작업을 이어갈 수 있어요.
                </span>
              </div>
            </div>
          )}

          {/* Section 1: 녹음 스크립트 + 녹음 컨트롤 */}
          <section className="cr-card">
            <span className="cr-tape" aria-hidden="true" />
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div className="cr-step-label" style={{ marginBottom: 2 }}>
                  STEP 1 · 녹음하기
                </div>
                <h3 style={{ fontFamily: 'var(--cr-font-serif)', fontWeight: 800, fontSize: 24, color: 'var(--cr-ink)', margin: 0, letterSpacing: '-0.5px' }}>
                  보이스 클론용 샘플 문장
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLoadModal(true)}
                disabled={readOnly}
                className="cr-btn-back"
                style={{ justifySelf: 'auto', opacity: readOnly ? 0.4 : 1, cursor: readOnly ? 'not-allowed' : 'pointer' }}
              >
                <FolderOpen className="w-4 h-4" /> 기존 음성 불러오기
              </button>
            </div>

            <div className="cr-vc-script">
              <div className="quote">"{vc.sampleScript}"</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 14px' }}>
              <span className={statusClass}>
                <StatusIcon className="w-4 h-4" />
                <span>{vc.statusLabel}</span>
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <button
                type="button"
                onClick={() => void vc.startRecording()}
                disabled={vc.status === 'recording' || readOnly}
                className={`cr-vc-mic${vc.status === 'recording' ? ' recording' : ''}`}
                aria-label="녹음 시작"
                style={readOnly ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
              >
                <Mic className="w-9 h-9" />
              </button>
              {vc.status === 'recording' && (
                <span
                  aria-live="polite"
                  style={{
                    fontFamily: 'var(--cr-font-mono, var(--cr-font-gaegu))',
                    fontSize: 30,
                    fontWeight: 800,
                    color: 'var(--cr-rust)',
                    letterSpacing: '0.5px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatAudioTime(vc.recordingElapsed)}
                </span>
              )}
              <p
                style={{
                  fontFamily: 'var(--cr-font-gaegu)',
                  fontSize: 19,
                  color: 'var(--cr-rust)',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {vc.status === 'recording'
                  ? '녹음 중...'
                  : '눌러서 새 음성 녹음을 시작하세요'}
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
              <button
                type="button"
                onClick={vc.stopRecording}
                disabled={vc.status !== 'recording'}
                className="cr-btn-back"
                style={{
                  justifySelf: 'auto',
                  background: '#fcefe7',
                  borderColor: 'var(--cr-rust)',
                  color: 'var(--cr-rust)',
                  boxShadow: '0 2px 0 var(--cr-rust)',
                  opacity: vc.status !== 'recording' ? 0.5 : 1,
                  cursor: vc.status !== 'recording' ? 'not-allowed' : 'pointer',
                }}
              >
                <Square className="w-4 h-4" /> 녹음 종료
              </button>
              <button
                type="button"
                onClick={vc.rerecord}
                disabled={readOnly}
                className="cr-btn-back"
                style={{
                  justifySelf: 'auto',
                  opacity: readOnly ? 0.4 : 1,
                  cursor: readOnly ? 'not-allowed' : 'pointer',
                }}
              >
                <RotateCcw className="w-4 h-4" /> 다시 녹음하기
              </button>
            </div>

            {/* 녹음 오디오 + 커스텀 플레이어 */}
            <audio
              ref={vc.audioRef}
              src={vc.recordedAudioUrl ?? undefined}
              style={{ display: 'none' }}
              onLoadedMetadata={e =>
                vc.setAudioDuration((e.currentTarget.duration as number | undefined) ?? 0)
              }
              onTimeUpdate={e => vc.setAudioCurrentTime(e.currentTarget.currentTime ?? 0)}
              onPlay={() => vc.setIsAudioPlaying(true)}
              onPause={() => vc.setIsAudioPlaying(false)}
              onEnded={() => vc.setIsAudioPlaying(false)}
            />
            <CreationAudioBar
              isPlaying={vc.isAudioPlaying}
              onToggle={vc.toggleAudioPlayback}
              disabled={!vc.recordedAudioUrl}
              progressPercent={progressPercent}
              onSeek={vc.seekAudio}
              currentLabel={formatAudioTime(vc.audioCurrentTime)}
              durationLabel={formatAudioTime(vc.audioDuration)}
            />

            {vc.status === 'ready' && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {/* "녹음 저장하기" 는 새로 녹음한 (= 아직 BE 에 저장 안 된) 클립일 때만 노출.
                    기존 음성을 불러왔거나 이미 저장된 직후에는 savedProfileId 가 채워져 있어
                    이미 BE 에 들어간 보이스라 "저장" 행위가 의미 없음. */}
                {vc.savedProfileId === null && (
                  <button
                    type="button"
                    onClick={() => setShowSaveModal(true)}
                    disabled={!vc.recordedAudioUrl || vc.isSaving || readOnly}
                    className="cr-btn-next"
                    style={{
                      justifySelf: 'auto',
                      opacity: readOnly ? 0.4 : undefined,
                      cursor: readOnly ? 'not-allowed' : undefined,
                    }}
                  >
                    <Save className="w-4 h-4" />
                    <span>{vc.isSaving ? '저장 중...' : '녹음 저장하기'}</span>
                  </button>
                )}
                {vc.savedProfileId ? (
                  <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 16, color: 'var(--cr-sage-deep)', fontWeight: 700, margin: 0 }}>
                    {vc.savedVoiceSummary}
                  </p>
                ) : (
                  <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 16, color: 'var(--cr-rust)', fontWeight: 700, margin: 0 }}>
                    녹음을 저장해야 보이스 클론이 적용돼요
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Section 2: TTS 미리듣기 */}
          <section className="cr-card">
            <span className="cr-tape" aria-hidden="true" />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--cr-sage-darker)',
                  color: '#fdf6dc',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Volume2 className="w-4 h-4" />
              </span>
              <div>
                <div className="cr-step-label" style={{ marginBottom: 2 }}>
                  STEP 2 · 변환된 음성 듣기
                </div>
                <h3 style={{ fontFamily: 'var(--cr-font-serif)', fontWeight: 800, fontSize: 22, color: 'var(--cr-ink)', margin: 0, letterSpacing: '-0.5px' }}>
                  보이스 클론으로 변환된 음성 듣기
                </h3>
              </div>
            </div>

            <div className="cr-field">
              <label className="cr-label" style={{ fontSize: 18 }}>
                TTS 로 들어볼 문장
              </label>
              <textarea
                value={vc.ttsText}
                onChange={e => vc.setTtsText(e.target.value)}
                rows={3}
                placeholder="동화 속 문장을 입력해 주세요."
                className="cr-textarea"
                disabled={readOnly}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => void vc.previewTts()}
                disabled={!vc.recordedAudioUrl || vc.isTtsLoading || readOnly}
                className="cr-btn-next"
                style={{
                  justifySelf: 'auto',
                  opacity: readOnly ? 0.4 : undefined,
                  cursor: readOnly ? 'not-allowed' : undefined,
                }}
              >
                <Wand2 className="w-4 h-4" />
                <span>{vc.isTtsLoading ? 'TTS 생성 중…' : 'TTS 들어보기'}</span>
              </button>
              <p
                style={{
                  fontFamily: 'var(--cr-font-gaegu)',
                  fontSize: 16,
                  color: 'var(--cr-ink-soft)',
                  margin: 0,
                  flex: 1,
                  minWidth: 200,
                }}
              >
                {vc.ttsStatusText}
              </p>
            </div>

            {vc.ttsAudioUrl && <TtsPreviewPlayer src={vc.ttsAudioUrl} />}
          </section>
        </main>
      </div>

      {vc.attachStatus === 'failed' && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 92,
            margin: '0 auto',
            maxWidth: 640,
            background: '#fcefe7',
            border: '2px solid var(--cr-rust)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontFamily: 'var(--cr-font-gaegu)',
            color: 'var(--cr-rust)',
            boxShadow: '0 3px 0 var(--cr-rust), 0 6px 14px rgba(180,90,50,0.2)',
            zIndex: 20,
          }}
        >
          <span>
            음성을 동화에 연결하지 못했어요. 잠시 후 "다시 연결" 을 눌러주세요.
            {vc.attachError && <span style={{ display: 'block', fontSize: 14, marginTop: 4, opacity: 0.8 }}>{vc.attachError}</span>}
          </span>
          <button
            type="button"
            onClick={() => void vc.retryAttach()}
            disabled={vc.attachStatus !== 'failed'}
            style={{
              flexShrink: 0,
              background: 'var(--cr-rust)',
              color: '#fdf6dc',
              border: '2px solid #8a4a32',
              borderRadius: 999,
              padding: '6px 16px',
              fontFamily: 'var(--cr-font-gaegu)',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            다시 연결
          </button>
        </div>
      )}

      <CreationFooter
        currentStep={6}
        onBack={onBack}
        rightSlot={
          <button
            type="button"
            onClick={onNext}
            className="cr-btn-next"
            /* readOnly = step 7 confirm 이후 재진입한 상태 → BE 에 voice_profile_id 가 이미 박혀있어
               FE 의 savedProfileId / attachStatus 는 component 리마운트로 비어있어도 진행 가능.
               이 가드를 안 풀면 사용자가 잠금된 버튼들 때문에 재attach 도 못해서 stuck 됨. */
            disabled={readOnly ? false : vc.savedProfileId === null || vc.attachStatus !== 'attached'}
            title={
              readOnly
                ? undefined
                : vc.savedProfileId === null
                  ? '녹음을 저장하거나 기존 음성을 불러와 주세요'
                  : vc.attachStatus === 'attaching'
                    ? '음성 연결 중...'
                    : vc.attachStatus === 'failed'
                      ? '음성 연결 실패 — 다시 연결 후 진행해 주세요'
                      : undefined
            }
          >
            <span>마지막 녹음하기</span>
            <Sparkles className="w-4 h-4" />
          </button>
        }
      />

      {showSaveModal && (
        <VoiceSaveModal
          isSaving={vc.isSaving}
          onSubmit={handleSaveSubmit}
          onClose={() => {
            // 저장 중에는 모달 안에서 disabled — 외부 닫기 시도도 막아 race 회피.
            if (!vc.isSaving) setShowSaveModal(false)
          }}
        />
      )}
      {showLoadModal && (
        <VoiceLoadModal
          fetchProfiles={vc.fetchVoiceProfiles}
          onSelect={handleProfileSelect}
          onClose={() => setShowLoadModal(false)}
        />
      )}
    </div>
  )
}

function TtsPreviewPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [src])

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      void audio.play()
    } else {
      audio.pause()
    }
  }

  const seekAudio = (percent: number) => {
    const audio = audioRef.current
    if (!audio || duration <= 0) return

    const nextTime = (Math.max(0, Math.min(100, percent)) / 100) * duration
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const progressPercent =
    duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0

  return (
    <div style={{ marginTop: 14 }}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        style={{ display: 'none' }}
        onLoadedMetadata={e => {
          const nextDuration = e.currentTarget.duration
          setDuration(Number.isFinite(nextDuration) ? nextDuration : 0)
        }}
        onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime ?? 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <CreationAudioBar
        isPlaying={isPlaying}
        onToggle={togglePlayback}
        disabled={false}
        progressPercent={progressPercent}
        onSeek={seekAudio}
        currentLabel={formatAudioTime(currentTime)}
        durationLabel={formatAudioTime(duration)}
      />
    </div>
  )
}

function CreationAudioBar({
  isPlaying,
  onToggle,
  disabled,
  progressPercent,
  onSeek,
  currentLabel,
  durationLabel,
}: {
  isPlaying: boolean
  onToggle: () => void
  disabled: boolean
  progressPercent: number
  onSeek: (percent: number) => void
  currentLabel: string
  durationLabel: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#fdf6dc',
        border: '2px solid var(--cr-caramel)',
        borderRadius: 999,
        padding: '8px 14px',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={isPlaying ? '일시정지' : '재생'}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--cr-sage)',
          border: '2px solid var(--cr-sage-deep)',
          color: '#fdf6dc',
          display: 'grid',
          placeItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          flexShrink: 0,
        }}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <div style={{ flex: 1, display: 'grid', gap: 4 }}>
        <input
          type="range"
          min={0}
          max={100}
          value={progressPercent}
          onChange={e => onSeek(Number(e.target.value))}
          disabled={disabled}
          aria-label="재생 위치"
          style={{ width: '100%', accentColor: 'var(--cr-sage-deep)' }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--cr-font-gaegu)',
            fontSize: 15,
            color: 'var(--cr-ink-soft)',
          }}
        >
          <span>{currentLabel}</span>
          <span>{durationLabel}</span>
        </div>
      </div>
    </div>
  )
}
