import {
  ArrowLeft,
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
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../../shared/constants'
import {
  VOICE_SAMPLE_SCRIPT,
  useVoiceClone,
  formatAudioTime,
} from '../../features/mypage'
// bookshelf.css 의 `bookshelf-modal / step-forest-modal / bookshelf-scroll` 스타일 재사용.
// 동화 생성 플로우와 같은 CSS 를 참조하지만, 이 페이지 자체 로직은 story-creation 과 완전히 분리.
import '../../features/bookshelf/styles/bookshelf.css'

/**
 * 마이페이지 → "+ 목소리 추가" 전용 페이지 (`/mypage/voice-clone`).
 *
 * 동화 생성 플로우의 `VoiceCloneStep` UI 를 기반으로 하되, 문맥에 맞춰 포팅:
 *  - "STEP 06" 스텝 카운터 헤더 → "마이페이지로" back 버튼 + "목소리 추가" 타이틀
 *  - "동화책 만들기" CTA → 서버 저장 후 자동으로 /mypage 복귀
 *  - POST /api/voice-profiles/presigned-url → S3 PUT → POST /api/voice-profiles 저장
 */
export function VoiceCloneAddPage() {
  const navigate = useNavigate()
  const vc = useVoiceClone()

  const StatusIcon =
    vc.status === 'recording' ? Mic : vc.status === 'ready' ? CheckCircle2 : Radio

  const statusBadgeClass =
    vc.status === 'recording'
      ? 'bg-[#8b3a2a] text-[#f0e6c0] border-[#c97b4a]'
      : vc.status === 'ready'
        ? 'bg-[#2d5a27] text-[#b4dc8c] border-[#b4dc8c]/50'
        : 'bg-[#e8ddb4] text-[#8b7a52] border-[#8b7a52]/40'

  const progressPercent = vc.audioDuration > 0 ? (vc.audioCurrentTime / vc.audioDuration) * 100 : 0

  const goBack = () => navigate(ROUTES.mypage)

  const handleSave = async () => {
    const name = await vc.saveVoiceRecording()
    if (name) goBack() // 저장 성공 시 마이페이지 복귀
  }

  return (
    <div className="bookshelf-modal step-forest-modal">
      {/* ── 헤더 (마이페이지 문맥 전용) ─────────────────────── */}
      <div className="flex items-center gap-4 py-4 px-8 border-b border-[#4a3a24] bg-[#2a1b12]/60 shrink-0">
        <button
          type="button"
          onClick={goBack}
          aria-label="마이페이지로 돌아가기"
          className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-[#4a3a24] text-[#d6c78e] bg-[#2a1b12]/70 hover:bg-[#2d5a27]/40 hover:text-[#f0e6c0] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="bookshelf-title-display text-2xl text-[#f0e6c0] font-bold">
          목소리 추가
        </span>
      </div>

      <div className="bookshelf-scroll">
        <main className="py-10 px-6 bookshelf-fade-in">
          <div className="max-w-4xl mx-auto pb-12">
            {/* 타이틀 */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <Mic className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl text-[#f0e6c0] font-bold">
                새 목소리를 녹음하거나 불러와 주세요
              </h2>
              <p className="text-[#b4c4a4] mt-2">
                샘플 문장을 읽어 녹음한 뒤, 보이스 클론으로 바뀐 TTS를 들어보고 제목과 함께
                저장합니다.
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
                      <h3 className="text-2xl text-[#2d5a27] font-bold">
                        보이스 클론용 샘플 문장
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={vc.loadExistingVoice}
                    className="px-5 py-3 rounded-full bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] hover:bg-[#b4dc8c] transition-colors flex items-center gap-2 self-start font-bold"
                  >
                    <FolderOpen className="w-4 h-4" /> 기존 음성 불러오기
                  </button>
                </div>

                <div className="rounded-[1.5rem] bg-[#e8ddb4] border-2 border-[#8b7a52]/40 p-6">
                  <p className="text-[#8b7a52] mb-3">읽기 가이드</p>
                  <p className="text-2xl md:text-3xl text-[#2d5a27] leading-relaxed font-bold text-center">
                    {VOICE_SAMPLE_SCRIPT}
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
                        {vc.status === 'recording'
                          ? '녹음 중...'
                          : '눌러서 새 음성 녹음을 시작하세요'}
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
                      onLoadedMetadata={(e) =>
                        vc.setAudioDuration(
                          (e.currentTarget.duration as number | undefined) ?? 0,
                        )
                      }
                      onTimeUpdate={(e) =>
                        vc.setAudioCurrentTime(e.currentTarget.currentTime ?? 0)
                      }
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
                        {vc.isAudioPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1 grid gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={progressPercent}
                          onChange={(e) => vc.seekAudio(Number(e.target.value))}
                          disabled={!vc.recordedAudioUrl}
                          className="w-full accent-[#2d5a27] cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="flex justify-between text-[#8b7a52] text-sm">
                          <span>{formatAudioTime(vc.audioCurrentTime)}</span>
                          <span>{formatAudioTime(vc.audioDuration)}</span>
                        </div>
                      </div>
                    </div>
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
                      onChange={(e) => vc.setTtsText(e.target.value)}
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

              {/* Section 3: 저장 */}
              <section className="bg-[#f0e6c0] p-6 md:p-8 rounded-[2rem] border-2 border-[#2a1b12] shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#c97b4a] flex items-center justify-center text-[#f0e6c0]">
                    <Save className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[#8b7a52] text-sm">음성 녹음 저장</p>
                    <h3 className="text-2xl text-[#2d5a27] font-bold">제목 입력 후 저장</h3>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border-2 border-[#8b7a52]/40 bg-[#e8ddb4] p-6">
                  <label className="block text-[#8b7a52] text-sm mb-2 font-bold">
                    저장할 보이스 제목
                  </label>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="text"
                      value={vc.voiceTitle}
                      onChange={(e) => vc.setVoiceTitle(e.target.value)}
                      placeholder="예: 엄마 제주 동화 목소리"
                      className="flex-1 p-4 rounded-2xl border-2 border-[#8b7a52]/60 bg-[#f0e6c0] text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/40 placeholder-[#8b7a52]/60"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={!vc.recordedAudioUrl || vc.isSaving}
                      className="bg-[#2d5a27] text-[#f0e6c0] px-8 py-3 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14] hover:bg-[#3d6f34] transition-all flex items-center justify-center gap-2 font-bold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_#1a3a14]"
                    >
                      <Save className="w-4 h-4" /> {vc.isSaving ? '저장 중...' : '저장하고 돌아가기'}
                    </button>
                  </div>

                  <div className="mt-5 rounded-[1.25rem] bg-[#f0e6c0] border-2 border-[#8b7a52]/40 p-4">
                    <p className="text-[#8b7a52] text-sm mb-1 font-bold">저장 상태</p>
                    <p className="text-[#2d5a27] text-lg">{vc.savedVoiceSummary}</p>
                  </div>
                </div>
              </section>
            </div>

            {/* 하단 — 마이페이지 복귀 CTA (저장 없이 나가기) */}
            <div className="mt-10 flex justify-center w-full">
              <button
                type="button"
                onClick={goBack}
                className="text-[#b4c4a4] hover:text-[#f0e6c0] px-8 py-3 text-lg font-bold transition-colors inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> 저장하지 않고 마이페이지로
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
