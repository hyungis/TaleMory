import { Fragment } from 'react'
import { Check } from 'lucide-react'
import { MAX_STEP } from '../model/types'

interface CreationHeaderProps {
  /** 현재 단계 (1 ~ MAX_STEP). */
  currentStep: number
}

/**
 * 동화 제작 플로우 공통 상단 헤더.
 *
 * 구성:
 *  - 좌측: Talemory 로고 (T 박스 + Gaegu script 로고타입)
 *  - 가운데: step 진행 dots (완료/현재/미완 3가지 상태)
 *  - 우측: "0N / 0M" 페이지 카운터
 *
 * 각 step 컴포넌트의 `.bookshelf-modal.step-forest-modal` flex column 최상단에 위치.
 */
export function CreationHeader({ currentStep }: CreationHeaderProps) {
  const total = MAX_STEP
  const paddedCurrent = String(currentStep).padStart(2, '0')
  const paddedTotal = String(total).padStart(2, '0')

  return (
    <div className="flex items-center justify-between py-3 px-6 border-b-2 border-[#9A7548]/30 bg-[#F4E4BC] shrink-0 gap-4">
      {/* 로고 */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-[#B9D38F] border-2 border-[#3F6B2E] rounded-lg flex items-center justify-center text-[#1F3318] font-bold text-base shadow-[0_2px_0_#3F6B2E]">
          T
        </div>
        <span
          className="text-[#3E2A18] font-bold text-lg tracking-wide hidden sm:inline"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
        >
          Talemory
        </span>
      </div>

      {/* 진행 단계 dots — connector 가 flex-grow 로 늘어나 가로 가득 채움. */}
      <div className="flex items-center flex-1 min-w-0 px-2">
        {Array.from({ length: total }, (_, i) => i + 1).map(step => {
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep
          const isLast = step === total
          return (
            <Fragment key={step}>
              <div
                className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold transition-colors ${
                  isCurrent
                    ? 'bg-[#B9D38F] border-[#3F6B2E] text-[#1F3318]'
                    : isCompleted
                      ? 'bg-[#3F6B2E] border-[#3F6B2E] text-[#FFFFE5]'
                      : 'bg-[#E9DBBE] border-[#9A7548]/40 text-[#76695A]'
                }`}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`단계 ${step}${isCurrent ? ' (현재)' : isCompleted ? ' (완료)' : ''}`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : step}
              </div>
              {!isLast && (
                <div
                  className={`flex-1 min-w-[8px] h-0.5 ${
                    isCompleted ? 'bg-[#3F6B2E]' : 'bg-[#9A7548]/30'
                  }`}
                  aria-hidden="true"
                />
              )}
            </Fragment>
          )
        })}
      </div>

      {/* 카운터 */}
      <div className="text-[#3E2A18] font-bold text-sm tracking-wider tabular-nums shrink-0">
        {paddedCurrent} / {paddedTotal}
      </div>
    </div>
  )
}
