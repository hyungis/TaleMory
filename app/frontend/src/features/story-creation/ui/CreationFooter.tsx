import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { MAX_STEP } from '../model/types'

interface CreationFooterProps {
  /** 현재 단계 (1 ~ MAX_STEP). */
  currentStep: number
  /** "← 뒤로" 클릭. */
  onBack: () => void
  /**
   * 우측 단순 다음 버튼 케이스 — onClick 핸들러.
   * `rightSlot` 이 제공되면 무시됨.
   */
  onNext?: () => void
  /** 다음 버튼 라벨 (기본 "다음으로"). */
  nextLabel?: string
  /** 다음 버튼 비활성. */
  nextDisabled?: boolean
  /** 자동 저장 표시 토글 — 자동저장 도입 step 만 true 로. */
  autoSaved?: boolean
  /**
   * 단순 다음 버튼이 아닌 복잡한 우측 액션 영역 (final/publish 의 다중 버튼 등).
   * 제공되면 onNext/nextLabel/nextDisabled 는 사용되지 않음.
   */
  rightSlot?: ReactNode
}

/**
 * 동화 제작 플로우 공통 하단 푸터.
 *
 * 구성:
 *  - 좌측: ← 뒤로
 *  - 가운데: "N/M 단계 · 자동 저장됨" status
 *  - 우측: 다음 버튼 (또는 rightSlot 으로 커스텀 액션)
 *
 * 각 step 컴포넌트의 `.bookshelf-modal.step-forest-modal` flex column 최하단에 위치.
 * `bookshelf-scroll` 영역 바깥 sibling 으로 두어 스크롤과 무관하게 viewport 하단 고정.
 */
export function CreationFooter({
  currentStep,
  onBack,
  onNext,
  nextLabel = '다음으로',
  nextDisabled,
  autoSaved = false,
  rightSlot,
}: CreationFooterProps) {
  const total = MAX_STEP
  const statusText = autoSaved
    ? `${currentStep}/${total} 단계 · 자동 저장됨`
    : `${currentStep}/${total} 단계`

  return (
    <div className="flex items-center justify-between py-3 px-6 border-t-2 border-[#9A7548]/30 bg-[#F4E4BC] shrink-0 gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 bg-[#E9DBBE] text-[#3E2A18] px-4 py-2 rounded-full border-2 border-[#9A7548]/40 hover:bg-[#D9BE82] transition-colors font-bold text-sm shrink-0"
      >
        <ArrowLeft className="w-4 h-4" /> 뒤로
      </button>

      <span className="text-[#76695A] text-sm font-bold tracking-wide truncate hidden sm:inline">
        {statusText}
      </span>

      {rightSlot ? (
        <div className="shrink-0 flex items-center gap-2">{rightSlot}</div>
      ) : onNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex items-center gap-1.5 bg-[#8DBA64] text-[#1F3318] px-5 py-2 rounded-full border-2 border-[#B9D38F] shadow-[0_3px_0_#3F6B2E] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3F6B2E] hover:bg-[#A6CB45] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_3px_0_#3F6B2E] transition-all font-bold text-sm whitespace-nowrap shrink-0"
        >
          {nextLabel} <ArrowRight className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  )
}
