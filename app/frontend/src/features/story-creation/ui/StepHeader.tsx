import { ArrowLeft } from 'lucide-react'
import { MAX_STEP } from '../model/types'

interface StepHeaderProps {
  stepNumber: number
  stepTitle: string
  onBack: () => void
}

/**
 * 제작 플로우 공통 상단 헤더.
 * - 좌측 back 버튼 (step > 1 일 때만 동작)
 * - "STEP 0N / 08" 카운터 + 한글 타이틀
 */
export function StepHeader({ stepNumber, stepTitle, onBack }: StepHeaderProps) {
  const padded = String(stepNumber).padStart(2, '0')
  const total = String(MAX_STEP).padStart(2, '0')
  return (
    <div className="flex items-center justify-between py-4 px-8 border-b border-[#4a3a24] bg-[#2a1b12]/60 shrink-0">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="이전 단계"
          className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-[#4a3a24] text-[#d6c78e] bg-[#2a1b12]/70 hover:bg-[#2d5a27]/40 hover:text-[#f0e6c0] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-[#b4c4a4] text-sm font-bold tracking-wider">
          STEP {padded} / {total}
        </span>
        <span className="bookshelf-title-display text-2xl text-[#f0e6c0] font-bold">{stepTitle}</span>
      </div>
    </div>
  )
}
