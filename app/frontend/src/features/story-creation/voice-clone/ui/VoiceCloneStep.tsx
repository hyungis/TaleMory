import { useCallback, useState } from 'react'
import { Mic, Square, RotateCcw, Play, Volume2 } from 'lucide-react'
import { StepHeader } from '../../ui/StepHeader'
import { NextButton } from '../../ui/NextButton'
import { useVoiceRecorder } from '../model/useVoiceRecorder'
import { DEFAULT_TTS_TEXT, VOICE_SAMPLE_SCRIPT } from '../lib/defaults'

interface VoiceCloneStepProps {
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 06 — 부모 목소리 녹음 + TTS 미리듣기.
 *
 * 현재(Task 7) 범위:
 *  - MediaRecorder 로 실제 녹음/중지/재녹음 가능
 *  - 녹음된 blob URL 을 <audio> 로 즉시 재생
 *  - TTS 생성 버튼은 stub (AI 서버 /tts 엔드포인트 연동은 후속)
 *
 * 녹음 파일의 AI 서버 업로드 + 음성 복제 파이프라인은 백엔드 연동 시 추가.
 */
export function VoiceCloneStep({ onBack, onNext }: VoiceCloneStepProps) {
  const recorder = useVoiceRecorder()
  const [ttsText, setTtsText] = useState(DEFAULT_TTS_TEXT)

  const handleTtsPreview = useCallback(() => {
    // TODO(S14P31S210-76): AI 서버 /tts 엔드포인트에 녹음 blob + ttsText POST → MP3 스트림 재생
    alert(`TTS 생성 (stub)\n텍스트: "${ttsText}"\n\n실제 AI 서버 연동은 백엔드 엔드포인트 확정 후 추가됩니다.`)
  }, [ttsText])

  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={6} stepTitle="엄마/아빠 목소리 녹음" onBack={onBack} />
      <div className="bookshelf-scroll">
        <main className="py-12 px-6 bookshelf-fade-in">
          <div className="max-w-3xl mx-auto bg-[#f0e6c0] p-8 md:p-12 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-2 border-[#2a1b12]">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <Mic className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl text-[#2d5a27] font-bold">아이에게 들려줄 목소리</h2>
              <p className="text-[#8b7a52] mt-2">한 줄만 녹음하면 AI 가 전체 동화를 그 목소리로 읽어줘요.</p>
            </div>

            {/* 샘플 스크립트 */}
            <div className="bg-[#e8ddb4] border-2 border-[#8b7a52]/40 rounded-xl p-5 mb-6">
              <p className="text-sm text-[#8b7a52] font-bold mb-2">다음 문장을 또렷하게 읽어주세요</p>
              <p className="text-lg text-[#2d5a27] font-bold leading-relaxed">{VOICE_SAMPLE_SCRIPT}</p>
            </div>

            {/* 녹음 컨트롤 */}
            <div className="flex flex-col items-center gap-4 mb-8">
              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center border-4 transition-all ${
                  recorder.status === 'recording'
                    ? 'bg-[#8b3a2a] border-[#c97b4a] animate-pulse shadow-[0_0_30px_rgba(201,123,74,0.5)]'
                    : 'bg-[#2d5a27] border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]'
                }`}
              >
                {recorder.status === 'recording' ? (
                  <Square className="w-12 h-12 text-[#f0e6c0]" />
                ) : (
                  <Mic className="w-12 h-12 text-[#f0e6c0]" />
                )}
              </div>

              <p className="text-[#2d5a27] font-bold">{recorder.statusLabel}</p>

              <div className="flex gap-3">
                {recorder.status === 'idle' && (
                  <button
                    type="button"
                    onClick={() => void recorder.start()}
                    className="bg-[#2d5a27] text-[#f0e6c0] px-6 py-3 rounded-full font-bold hover:bg-[#3d6f34] transition-colors"
                  >
                    🎙 녹음 시작
                  </button>
                )}
                {recorder.status === 'recording' && (
                  <button
                    type="button"
                    onClick={recorder.stop}
                    className="bg-[#8b3a2a] text-[#f0e6c0] px-6 py-3 rounded-full font-bold hover:bg-[#a84a35] transition-colors"
                  >
                    ⏹ 녹음 중지
                  </button>
                )}
                {recorder.status === 'ready' && (
                  <>
                    <button
                      type="button"
                      onClick={recorder.reset}
                      className="bg-[#8b7a52] text-[#f0e6c0] px-5 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-[#a89664] transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" /> 다시 녹음
                    </button>
                  </>
                )}
              </div>

              {recorder.error && (
                <p className="text-sm text-[#8b3a2a] bg-[#8b3a2a]/10 border border-[#8b3a2a]/40 px-3 py-2 rounded-lg">
                  {recorder.error}
                </p>
              )}

              {recorder.audioUrl && (
                <audio
                  src={recorder.audioUrl}
                  controls
                  className="w-full max-w-md mt-2"
                />
              )}
            </div>

            {/* TTS 미리듣기 */}
            <div className="bg-[#e8ddb4]/60 border-2 border-[#8b7a52]/40 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="w-5 h-5 text-[#2d5a27]" />
                <span className="text-[#2d5a27] font-bold">이 목소리로 다른 문장 들어보기</span>
              </div>
              <textarea
                value={ttsText}
                onChange={e => setTtsText(e.target.value)}
                rows={3}
                className="w-full p-3 bg-[#f0e6c0] border border-[#8b7a52]/40 rounded-lg text-[#2d5a27] mb-3 resize-none"
              />
              <button
                type="button"
                onClick={handleTtsPreview}
                disabled={!recorder.audioUrl}
                className="w-full bg-[#2d5a27] text-[#f0e6c0] py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#3d6f34] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Play className="w-4 h-4" /> AI 로 만들어서 들어보기
              </button>
              {!recorder.audioUrl && (
                <p className="text-xs text-[#8b7a52] mt-2 text-center">녹음부터 완료해주세요.</p>
              )}
            </div>

            <NextButton onClick={onNext}>최종 미리보기</NextButton>
          </div>
        </main>
      </div>
    </div>
  )
}
