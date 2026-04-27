import {
  CheckCircle2,
  FolderOpen,
  Mic,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Save,
  ScrollText,
  Sparkles,
  Square,
  Volume2,
  Wand2,
} from 'lucide-react'
import { StepHeader } from '../../ui/StepHeader'
import { formatAudioTime, useVoiceClone } from '../model/useVoiceClone'

interface VoiceCloneStepProps {
  storyId?: number | null
  onBack: () => void
  onNext: () => void
  /**
   * 저장 성공 시 보이스 이름 전달 → 상위 projectData.step6.voiceModel 에 반영.
   * 저장 없이 "동화책 만들기"로 넘어갈 수도 있으므로 선택 prop.
   */
  onVoiceSaved?: (voiceModel: string) => void
}

/**
 * STEP 06 — "스토리북 보이스"
 *
 * 3 섹션 레이아웃:
 *  1. 녹음 스크립트 + 녹음 컨트롤 (status 배지 + 마이크 버튼 + 종료/다시녹음 + 커스텀 플레이어)
 *  2. TTS 미리듣기 (텍스트 입력 + AI 호출 + 결과 <audio controls>)
 *  3. 저장 (제목 입력 + 저장 버튼 + 저장 상태 요약)
 *
 * 하단 네비: 이전 단계 / "동화책 만들기 ✨"
 */
export function VoiceCloneStep({ storyId, onBack, onNext, onVoiceSaved }: VoiceCloneStepProps) {
  const vc = useVoiceClone(storyId)

  const StatusIcon =
    vc.status === 'recording' ? Mic : vc.status === 'ready' ? CheckCircle2 : Radio

  const statusBadgeClass =
    vc.status === 'recording'
      ? 'bg-[#8b3a2a] text-[#f0e6c0] border-[#c97b4a]'
      : vc.status === 'ready'
        ? 'bg-[#2d5a27] text-[#b4dc8c] border-[#b4dc8c]/50'
        : 'bg-[#e8ddb4] text-[#8b7a52] border-[#8b7a52]/40'

  const progressPercent = vc.audioDuration > 0 ? (vc.audioCurrentTime / vc.audioDuration) * 100 : 0

  const handleSave = async () => {
    const name = await vc.saveVoiceRecording()
    if (name && onVoiceSaved) onVoiceSaved(name)
  }

  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={6} stepTitle="스토리북 보이스" onBack={onBack} />

      <div className="bookshelf-scroll">
        <main className="py-10 px-6 bookshelf-fade-in">
          <div className="max-w-4xl mx-auto pb-12">
            {/* 타이틀 */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <Mic className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl text-[#f0e6c0] font-bold">
                부모 목소리를 불러오거나 새로 녹음해 주세요
              </h2>
              <p className="text-[#b4c4a4] mt-2">
                샘플 문장을 읽어 녹음한 뒤, 보이스 클론으로 바뀐 TTS를 들어보고 제목과 함께 저장합니다.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {/* Section 1: 녹음 스크립트 + 녹음 컨트롤 */}
              <section className="bg-[#f0e6c0] p-6 md:p-8 rounded-[2rem] border-2 border-[#2a1b12] shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#2d5a27] flex items-center justify-center text-[#b4dc8c] border border-[#b4dc8c]/40">
                      <ScrollText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[#8b7a52] text-sm">녹음 스크립트</p>
                      <h3 className="text-2xl text-[#2d5a27] font-bold">보이스 클론용 샘플 문장</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void vc.loadExistingVoice()}
                    className="px-5 py-3 rounded-full bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] hover:bg-[#b4dc8c] transition-colors flex items-center gap-2 self-start font-bold"
                  >
                    <FolderOpen className="w-4 h-4" /> 기존 음성 불러오기
                  </button>
                </div>

                <div className="rounded-[1.5rem] bg-[#e8ddb4] border-2 border-[#8b7a52]/40 p-6">
                  <p className="text-[#8b7a52] mb-3">읽기 가이드</p>
                  <p className="text-2xl md:text-3xl text-[#2d5a27] leading-relaxed font-bold text-center">
                    {vc.sampleScript}
                  </p>

                  <div className="mt-8 text-center">
                    {/* Status indicator */}
                    <div className="flex justify-center mb-6">
                      <div
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-bold ${statusBadgeClass}`}
                      >
                        <StatusIcon className="w-5 h-5" />
                        <span>{vc.statusLabel}</span>
                      </div>
                    </div>

                    {/* 녹음 시작 버튼 */}
                    <div className="flex flex-col items-center justify-center gap-4 mb-6">
                      <button
                        type="button"
                        onClick={() => void vc.startRecording()}
                        disabled={vc.status === 'recording'}
                        className={`w-24 h-24 rounded-full flex items-center justify-center border-4 border-[#f0e6c0] shadow-lg transition-colors ${
                          vc.status === 'recording'
                            ? 'bg-[#8b3a2a]/50 text-[#f0e6c0] cursor-not-allowed'
                            : 'bg-[#8b3a2a] text-[#f0e6c0] hover:bg-[#a84a35]'
                        }`}
                      >
                        <Mic className="w-10 h-10" />
                      </button>
                      <p className="text-[#8b3a2a] text-xl font-bold">
                        {vc.status === 'recording' ? '녹음 중...' : '눌러서 새 음성 녹음을 시작하세요'}
                      </p>
                    </div>

                    {/* 녹음 종료/다시 */}
                    <div className="flex flex-wrap justify-center gap-3 mb-6">
                      <button
                        type="button"
                        onClick={vc.stopRecording}
                        disabled={vc.status !== 'recording'}
                        className="px-6 py-3 rounded-full bg-[#c97b4a] text-[#f0e6c0] hover:bg-[#d88a58] transition-colors flex items-center gap-2 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Square className="w-4 h-4" /> 녹음 종료
                      </button>
                      <button
                        type="button"
                        onClick={vc.rerecord}
                        className="px-6 py-3 rounded-full bg-[#f0e6c0] border-2 border-[#8b7a52]/60 text-[#2d5a27] hover:bg-[#b4dc8c] transition-colors flex items-center gap-2 font-bold"
                      >
                        <RotateCcw className="w-4 h-4" /> 다시 녹음하기
                      </button>
                    </div>

                    {/* 녹음 오디오 엘리먼트(숨김) + 커스텀 플레이어 */}
                    <audio
                      ref={vc.audioRef}
                      src={vc.recordedAudioUrl ?? undefined}
                      className="hidden"
                      onLoadedMetadata={e =>
                        vc.setAudioDuration((e.currentTarget.duration as number | undefined) ?? 0)
                      }
                      onTimeUpdate={e => vc.setAudioCurrentTime(e.currentTarget.currentTime ?? 0)}
                      onPlay={() => vc.setIsAudioPlaying(true)}
                      onPause={() => vc.setIsAudioPlaying(false)}
                      onEnded={() => vc.setIsAudioPlaying(false)}
                    />
                    <div className="flex items-center gap-3 bg-[#f0e6c0] border-2 border-[#8b7a52]/40 rounded-full px-4 py-3">
                      <button
                        type="button"
                        onClick={vc.toggleAudioPlayback}
                        disabled={!vc.recordedAudioUrl}
                        aria-label={vc.isAudioPlaying ? '일시정지' : '재생'}
                        className="w-11 h-11 rounded-full bg-[#2d5a27] text-[#f0e6c0] flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3d6f34] transition-colors"
                      >
                        {vc.isAudioPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>
                      <div className="flex-1 grid gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={progressPercent}
                          onChange={e => vc.seekAudio(Number(e.target.value))}
                          disabled={!vc.recordedAudioUrl}
                          className="w-full accent-[#2d5a27] cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="flex justify-between text-[#8b7a52] text-sm">
                          <span>{formatAudioTime(vc.audioCurrentTime)}</span>
                          <span>{formatAudioTime(vc.audioDuration)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 녹음 원본 저장 */}
                    {vc.status === 'ready' && (
                      <div className="mt-6 flex flex-col items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSave()}
                          disabled={!vc.recordedAudioUrl || vc.isSaving}
                          className="bg-[#2d5a27] text-[#f0e6c0] px-8 py-3 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14] hover:bg-[#3d6f34] transition-all flex items-center justify-center gap-2 font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_#1a3a14]"
                        >
                          <Save className="w-4 h-4" /> {vc.isSaving ? '저장 중...' : '녹음 저장하기'}
                        </button>
                        {vc.savedProfileId && (
                          <p className="text-[#2d5a27] text-sm font-bold">{vc.savedVoiceSummary}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Section 2: TTS 미리듣기 */}
              <section className="bg-[#f0e6c0] p-6 md:p-8 rounded-[2rem] border-2 border-[#2a1b12] shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#c97b4a] flex items-center justify-center text-[#f0e6c0]">
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[#8b7a52] text-sm">TTS 미리듣기</p>
                    <h3 className="text-2xl text-[#2d5a27] font-bold">
                      보이스 클론으로 변환된 음성 듣기
                    </h3>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border-2 border-[#8b7a52]/40 bg-[#e8ddb4] p-6 grid gap-4">
                  <div>
                    <label className="block text-[#8b7a52] text-sm mb-2 font-bold">
                      TTS로 들어볼 문장
                    </label>
                    <textarea
                      value={vc.ttsText}
                      onChange={e => vc.setTtsText(e.target.value)}
                      rows={3}
                      placeholder="동화 속 문장을 입력해 주세요."
                      className="w-full p-4 rounded-2xl border-2 border-[#8b7a52]/60 bg-[#f0e6c0] text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/40 resize-none"
                    />
                  </div>

                  <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <button
                      type="button"
                      onClick={() => void vc.previewTts()}
                      disabled={!vc.recordedAudioUrl || vc.isTtsLoading}
                      className="bg-[#c97b4a] text-[#f0e6c0] px-7 py-3 rounded-full shadow-[0_4px_0_#8b3a2a] hover:translate-y-1 hover:shadow-[0_2px_0_#8b3a2a] hover:bg-[#d88a58] transition-all flex items-center justify-center gap-2 font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_#8b3a2a]"
                    >
                      <Wand2 className="w-4 h-4" />
                      {vc.isTtsLoading ? 'TTS 생성 중...' : 'TTS 들어보기'}
                    </button>
                    <p className="text-[#8b7a52] text-sm flex-1">{vc.ttsStatusText}</p>
                  </div>

                  {vc.ttsAudioUrl && (
                    <audio src={vc.ttsAudioUrl} controls className="w-full mt-2" />
                  )}
                </div>
              </section>

              {/* Section 3: TTS 음성 저장 */}
              <section className="bg-[#f0e6c0] p-6 md:p-8 rounded-[2rem] border-2 border-[#2a1b12] shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#c97b4a] flex items-center justify-center text-[#f0e6c0]">
                    <Save className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[#8b7a52] text-sm">TTS 음성 저장</p>
                    <h3 className="text-2xl text-[#2d5a27] font-bold">생성된 TTS를 동화에 적용</h3>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border-2 border-[#8b7a52]/40 bg-[#e8ddb4] p-6">
                  <p className="text-[#8b7a52] text-sm mb-4">
                    {vc.ttsAudioUrl
                      ? 'TTS가 생성되었습니다. 제목을 입력하고 동화에 적용하세요.'
                      : '먼저 위에서 녹음을 저장하고, TTS 미리듣기를 완료해 주세요.'}
                  </p>

                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-[#8b7a52] text-sm mb-2 font-bold">
                        TTS 보이스 제목
                      </label>
                      <input
                        type="text"
                        value={vc.voiceTitle}
                        onChange={e => vc.setVoiceTitle(e.target.value)}
                        placeholder="예: 엄마 제주 동화 목소리"
                        disabled={!vc.ttsAudioUrl}
                        className="w-full p-3 rounded-2xl border-2 border-[#8b7a52]/60 bg-[#f0e6c0] text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/40 placeholder-[#8b7a52]/60 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!vc.ttsAudioUrl}
                      className="bg-[#2d5a27] text-[#f0e6c0] px-8 py-3 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14] hover:bg-[#3d6f34] transition-all flex items-center justify-center gap-2 font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_#1a3a14] self-start"
                    >
                      <Save className="w-4 h-4" /> TTS 음성 저장하기
                    </button>
                  </div>

                  <div className="mt-5 rounded-[1.25rem] bg-[#f0e6c0] border-2 border-[#8b7a52]/40 p-4">
                    <p className="text-[#8b7a52] text-sm mb-1 font-bold">저장 상태</p>
                    <p className="text-[#2d5a27] text-lg">{vc.savedVoiceSummary}</p>
                  </div>
                </div>
              </section>
            </div>

            {/* 하단 네비 */}
            <div className="mt-10 flex justify-between items-center w-full bg-[#2a1b12]/70 p-4 rounded-full shadow-sm border-2 border-[#4a3a24]">
              <button
                type="button"
                onClick={onBack}
                className="text-[#b4c4a4] hover:text-[#f0e6c0] px-4 py-2 text-lg font-bold transition-colors"
              >
                이전 단계
              </button>
              <button
                type="button"
                onClick={onNext}
                className="bg-[#2d5a27] text-[#f0e6c0] text-xl px-10 py-3 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.5)] hover:bg-[#3d6f34] transition-all flex items-center gap-2 font-bold"
              >
                동화책 만들기 <Sparkles className="w-5 h-5" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
