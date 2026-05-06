import { Mic, Play, Volume2 } from 'lucide-react'

interface VoicePlayerMockProps {
  /** 보이스 모델 이름 (step6.voiceModel). null 이면 기본 '엄마 목소리' 표기. */
  voiceModel: string | null
}

/**
 * 완성된 동화책 미리보기 우측 하단의 음성 플레이어 목업.
 * 실제 재생 로직은 후속 커밋(step6 voiceModel 오디오와 연결)에서 구현.
 * 현재는 정적 프로그레스(1/3) + 플레이 아이콘.
 */
export function VoicePlayerMock({ voiceModel }: VoicePlayerMockProps) {
  const label = voiceModel?.trim() || '엄마 목소리'
  return (
    <div className="bg-[#f0e6c0] border-2 border-[#8b7a52]/40 rounded-full p-2.5 flex items-center gap-4 shadow-sm max-w-sm">
      <button
        type="button"
        aria-label="재생"
        className="bg-[#2d5a27] text-[#f0e6c0] w-12 h-12 rounded-full flex items-center justify-center hover:bg-[#3d6f34] hover:shadow-[0_0_14px_rgba(180,220,140,0.5)] transition-all"
      >
        <Play className="w-5 h-5 ml-1" />
      </button>
      <div className="flex-1">
        <div className="flex justify-between text-sm text-[#8b7a52] font-sans mb-1 font-bold">
          <span>0:00</span>
          <span className="text-[#2d5a27] flex items-center gap-1">
            <Mic className="w-3 h-3" /> {label}
          </span>
        </div>
        <div className="h-2.5 bg-[#e8ddb4] rounded-full overflow-hidden relative cursor-pointer">
          <div className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-[#b4dc8c] to-[#2d5a27] rounded-full" />
        </div>
      </div>
      <button
        type="button"
        aria-label="음량"
        className="text-[#8b7a52] hover:text-[#2d5a27] pr-3 transition-colors"
      >
        <Volume2 className="w-5 h-5" />
      </button>
    </div>
  )
}
