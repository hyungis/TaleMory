import {
  CheckCircle2,
  FolderOpen,
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
import '../../styles/creation-paper.css'

interface VoiceCloneStepProps {
  storyId?: number | null
  onBack: () => void
  onNext: () => void
  onVoiceSaved?: (voiceModel: string) => void
}

/**
 * STEP 06 — paper-craft 톤 (Claude offline.html 1:1).
 * 3 섹션: 녹음 / TTS 미리듣기 / TTS 저장.
 * 모든 useVoiceClone 로직 그대로 유지.
 */
export function VoiceCloneStep({ storyId, onBack, onNext, onVoiceSaved }: VoiceCloneStepProps) {
  const vc = useVoiceClone(storyId)

  const StatusIcon =
    vc.status === 'recording' ? Mic : vc.status === 'ready' ? CheckCircle2 : Radio

  const statusClass =
    vc.status === 'recording'
      ? 'cr-vc-status recording'
      : vc.status === 'ready'
        ? 'cr-vc-status ready'
        : 'cr-vc-status'

  const progressPercent = vc.audioDuration > 0 ? (vc.audioCurrentTime / vc.audioDuration) * 100 : 0

  const handleSave = async () => {
    const name = await vc.saveVoiceRecording()
    if (name && onVoiceSaved) onVoiceSaved(name)
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
            subtitle="샘플 문장을 따라 읽어 녹음하면, 보이스 클론으로 동화를 들려줄 수 있어요"
          />

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
                <h3 style={{ fontFamily: 'var(--cr-font-serif)', fontWeight: 800, fontSize: 22, color: 'var(--cr-ink)', margin: 0, letterSpacing: '-0.5px' }}>
                  보이스 클론용 샘플 문장
                </h3>
              </div>
              <button
                type="button"
                onClick={() => void vc.loadExistingVoice()}
                className="cr-btn-back"
                style={{ justifySelf: 'auto' }}
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
                disabled={vc.status === 'recording'}
                className={`cr-vc-mic${vc.status === 'recording' ? ' recording' : ''}`}
                aria-label="녹음 시작"
              >
                <Mic className="w-9 h-9" />
              </button>
              <p
                style={{
                  fontFamily: 'var(--cr-font-gaegu)',
                  fontSize: 17,
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
                className="cr-btn-back"
                style={{ justifySelf: 'auto' }}
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
                onClick={vc.toggleAudioPlayback}
                disabled={!vc.recordedAudioUrl}
                aria-label={vc.isAudioPlaying ? '일시정지' : '재생'}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--cr-sage)',
                  border: '2px solid var(--cr-sage-deep)',
                  color: '#fdf6dc',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: vc.recordedAudioUrl ? 'pointer' : 'not-allowed',
                  opacity: vc.recordedAudioUrl ? 1 : 0.5,
                  flexShrink: 0,
                }}
              >
                {vc.isAudioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <div style={{ flex: 1, display: 'grid', gap: 4 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progressPercent}
                  onChange={e => vc.seekAudio(Number(e.target.value))}
                  disabled={!vc.recordedAudioUrl}
                  style={{ width: '100%', accentColor: 'var(--cr-sage-deep)' }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: 'var(--cr-font-gaegu)',
                    fontSize: 13,
                    color: 'var(--cr-ink-soft)',
                  }}
                >
                  <span>{formatAudioTime(vc.audioCurrentTime)}</span>
                  <span>{formatAudioTime(vc.audioDuration)}</span>
                </div>
              </div>
            </div>

            {vc.status === 'ready' && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!vc.recordedAudioUrl || vc.isSaving}
                  className="cr-btn-next"
                  style={{ justifySelf: 'auto' }}
                >
                  <Save className="w-4 h-4" />
                  <span>{vc.isSaving ? '저장 중...' : '녹음 저장하기'}</span>
                </button>
                {vc.savedProfileId && (
                  <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 14, color: 'var(--cr-sage-deep)', fontWeight: 700, margin: 0 }}>
                    {vc.savedVoiceSummary}
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
                <h3 style={{ fontFamily: 'var(--cr-font-serif)', fontWeight: 800, fontSize: 20, color: 'var(--cr-ink)', margin: 0, letterSpacing: '-0.5px' }}>
                  보이스 클론으로 변환된 음성 듣기
                </h3>
              </div>
            </div>

            <div className="cr-field">
              <label className="cr-label" style={{ fontSize: 16 }}>
                TTS 로 들어볼 문장
              </label>
              <textarea
                value={vc.ttsText}
                onChange={e => vc.setTtsText(e.target.value)}
                rows={3}
                placeholder="동화 속 문장을 입력해 주세요."
                className="cr-textarea"
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => void vc.previewTts()}
                disabled={!vc.recordedAudioUrl || vc.isTtsLoading}
                className="cr-btn-next"
                style={{ justifySelf: 'auto' }}
              >
                <Wand2 className="w-4 h-4" />
                <span>{vc.isTtsLoading ? 'TTS 생성 중…' : 'TTS 들어보기'}</span>
              </button>
              <p
                style={{
                  fontFamily: 'var(--cr-font-gaegu)',
                  fontSize: 14,
                  color: 'var(--cr-ink-soft)',
                  margin: 0,
                  flex: 1,
                  minWidth: 200,
                }}
              >
                {vc.ttsStatusText}
              </p>
            </div>

            {vc.ttsAudioUrl && (
              <audio
                src={vc.ttsAudioUrl}
                controls
                style={{ width: '100%', marginTop: 14, borderRadius: 999 }}
              />
            )}
          </section>

          {/* Section 3: TTS 저장 */}
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
                <Save className="w-4 h-4" />
              </span>
              <div>
                <div className="cr-step-label" style={{ marginBottom: 2 }}>
                  STEP 3 · 저장
                </div>
                <h3 style={{ fontFamily: 'var(--cr-font-serif)', fontWeight: 800, fontSize: 20, color: 'var(--cr-ink)', margin: 0, letterSpacing: '-0.5px' }}>
                  TTS를 동화에 적용
                </h3>
              </div>
            </div>

            <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 15, color: 'var(--cr-ink-soft)', margin: '0 0 12px' }}>
              {vc.ttsAudioUrl
                ? 'TTS 가 생성됐어요. 제목을 입력하고 동화에 적용하세요.'
                : '먼저 위에서 녹음을 저장하고 TTS 미리듣기를 완료해 주세요.'}
            </p>

            <div className="cr-field">
              <label className="cr-label" style={{ fontSize: 16 }}>
                TTS 보이스 제목
              </label>
              <input
                type="text"
                value={vc.voiceTitle}
                onChange={e => vc.setVoiceTitle(e.target.value)}
                placeholder="예: 엄마 제주 동화 목소리"
                disabled={!vc.ttsAudioUrl}
                className="cr-input"
              />
            </div>

            <button
              type="button"
              disabled={!vc.ttsAudioUrl}
              className="cr-btn-next"
              style={{ justifySelf: 'flex-start', marginTop: 4 }}
            >
              <Save className="w-4 h-4" /> <span>TTS 음성 저장하기</span>
            </button>

            <div
              style={{
                marginTop: 14,
                background: '#fbf2da',
                border: '1.5px dashed var(--cr-caramel)',
                borderRadius: 14,
                padding: '12px 16px',
              }}
            >
              <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 13, color: 'var(--cr-caramel-deep)', fontWeight: 700, margin: '0 0 2px' }}>
                저장 상태
              </p>
              <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 16, color: 'var(--cr-ink)', fontWeight: 700, margin: 0 }}>
                {vc.savedVoiceSummary}
              </p>
            </div>
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
            {vc.attachError && <span style={{ display: 'block', fontSize: 12, marginTop: 4, opacity: 0.8 }}>{vc.attachError}</span>}
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
              fontSize: 14,
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
            disabled={vc.savedProfileId !== null && vc.attachStatus !== 'attached'}
            title={
              vc.savedProfileId !== null && vc.attachStatus === 'attaching'
                ? '음성 연결 중...'
                : vc.savedProfileId !== null && vc.attachStatus === 'failed'
                  ? '음성 연결 실패 — 다시 연결 후 진행해 주세요'
                  : undefined
            }
          >
            <span>동화책 만들기</span>
            <Sparkles className="w-4 h-4" />
          </button>
        }
      />
    </div>
  )
}
