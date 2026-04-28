import { useCallback, useRef, useState } from 'react'
import { ImageOff, Pause, Play, Quote, Volume2 } from 'lucide-react'
import type { SceneDto } from '../../highlight-outro/api/highlightOutroApi'

interface BookSpreadProps {
  scene: SceneDto
  /** 0-based 페이지 인덱스. 표시용 페이지 번호는 idx*2+1 / idx*2+2. */
  pageIndex: number
}

/**
 * 펼쳐진 동화책 1 스프레드(좌/우 2페이지).
 * - 왼쪽: 실제 삽화 이미지 (illustrationUrl)
 * - 오른쪽: 영문/한글 본문 + TTS 오디오 플레이어
 */
export function BookSpread({ scene, pageIndex }: BookSpreadProps) {
  const firstSentence = scene.sentences[0]
  const englishText = scene.sentences.map(s => s.englishText).join(' ')
  const koreanText = scene.sentences.map(s => s.koreanText ?? '').join(' ')
  const ttsUrl = firstSentence?.ttsAudioUrl ?? null

  return (
    <div className="w-full aspect-auto md:aspect-[2/1.1] bg-[#fff9dd] rounded-xl md:rounded-3xl flex flex-col md:flex-row relative border-2 border-[#2a1b12] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* 중앙 접힘선 */}
      <div
        className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-12 pointer-events-none z-20"
        style={{
          background:
            'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.15) 50%, rgba(255,255,255,0.4) 55%, rgba(0,0,0,0) 100%)',
        }}
      />

      {/* 왼쪽 페이지: 삽화 */}
      <div className="flex-1 p-6 md:p-10 flex items-center justify-center relative">
        <div className="absolute bottom-4 left-8 text-[#8b7a52] font-sans text-sm">
          {pageIndex * 2 + 1}
        </div>
        <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner border border-[#f0e6c0]/70 relative">
          {scene.illustrationUrl ? (
            <img
              src={scene.illustrationUrl}
              alt={`씬 ${scene.pageNumber} 삽화`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#e8ddb4] to-[#b4dc8c]/60 flex flex-col items-center justify-center">
              <ImageOff className="w-16 h-16 text-[#8b7a52] opacity-50 mb-3" />
              <p className="text-[#8b7a52] text-sm">삽화 생성 중...</p>
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽 페이지: 글 + 음성 */}
      <div className="flex-1 p-6 md:p-12 flex flex-col relative">
        <div className="absolute bottom-4 right-8 text-[#8b7a52] font-sans text-sm">
          {pageIndex * 2 + 2}
        </div>

        <Quote className="w-10 h-10 text-[#b4dc8c] opacity-60 mb-4" />

        <p className="text-2xl md:text-3xl lg:text-[2.2rem] text-[#2a1b12] leading-[1.5] font-sans font-medium">
          {englishText}
        </p>

        <div className="w-16 h-1 bg-[#b4dc8c] rounded-full my-6" />

        <p className="text-lg md:text-xl text-[#8b7a52] leading-relaxed">{koreanText}</p>

        {/* TTS 오디오 플레이어 */}
        <div className="mt-auto pt-6">
          {ttsUrl ? <TtsPlayer src={ttsUrl} /> : <TtsPlayerDisabled />}
        </div>
      </div>
    </div>
  )
}

function TtsPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play().catch(() => {})
    }
    setPlaying(!playing)
  }, [playing])

  const handleEnded = useCallback(() => setPlaying(false), [])

  return (
    <div className="bg-[#f0e6c0] border-2 border-[#8b7a52]/40 rounded-full p-2.5 flex items-center gap-4 shadow-sm max-w-sm">
      <audio ref={audioRef} src={src} onEnded={handleEnded} preload="none" />
      <button
        type="button"
        aria-label={playing ? '정지' : '재생'}
        onClick={toggle}
        className="bg-[#2d5a27] text-[#f0e6c0] w-12 h-12 rounded-full flex items-center justify-center hover:bg-[#3d6f34] hover:shadow-[0_0_14px_rgba(180,220,140,0.5)] transition-all"
      >
        {playing ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-1" />
        )}
      </button>
      <div className="flex-1">
        <div className="flex justify-between text-xs text-[#8b7a52] font-sans mb-1 font-bold">
          <span>TTS</span>
        </div>
        <div className="h-2.5 bg-[#e8ddb4] rounded-full overflow-hidden" />
      </div>
      <span className="text-[#8b7a52] pr-3">
        <Volume2 className="w-5 h-5" />
      </span>
    </div>
  )
}

function TtsPlayerDisabled() {
  return (
    <div className="bg-[#f0e6c0]/60 border-2 border-[#8b7a52]/20 rounded-full p-2.5 flex items-center gap-4 shadow-sm max-w-sm opacity-50">
      <div className="bg-[#8b7a52] text-[#f0e6c0] w-12 h-12 rounded-full flex items-center justify-center">
        <Play className="w-5 h-5 ml-1" />
      </div>
      <span className="text-[#8b7a52] text-sm font-bold">음성 없음</span>
    </div>
  )
}
