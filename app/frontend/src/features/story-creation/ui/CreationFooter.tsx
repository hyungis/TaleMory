import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { MAX_STEP } from '../model/types'

interface CreationFooterProps {
  /** 현재 단계 (1 ~ MAX_STEP). */
  currentStep: number
  /** "← 이전" 클릭. */
  onBack: () => void
  /**
   * 이전 버튼 비활성 — Step 9(발행 완료) 처럼 더 이상 뒤로 못 돌아가야 하는 단계에서 사용.
   * disabled 시 클릭 무효화 + 회색/포커스 불가능 표시.
   */
  backDisabled?: boolean
  /**
   * 우측 단순 다음 버튼 케이스 — onClick 핸들러.
   * `rightSlot` 이 제공되면 무시됨.
   */
  onNext?: () => void
  /** 다음 버튼 라벨 (기본 "다음으로"). */
  nextLabel?: string
  /** 다음 버튼 비활성. */
  nextDisabled?: boolean
  /** 자동 저장 표시 토글 — autoSaved=true 시 카운터 옆에 "자동 저장됨" 노출. */
  autoSaved?: boolean
  /**
   * 단순 다음 버튼이 아닌 복잡한 우측 액션 영역 (final/publish 의 다중 버튼 등).
   * 제공되면 onNext/nextLabel/nextDisabled 는 사용되지 않음.
   */
  rightSlot?: ReactNode
}

/**
 * 동화 제작 플로우 공통 하단 푸터 — paper-craft 톤.
 *
 * 구성:
 *  - 좌측: ← 이전 (paper pill)
 *  - 가운데: "N / 9 단계" Pen Script 페이지 카운터
 *  - 우측: 다음 버튼 (Nanum Myeongjo + sage), 또는 rightSlot 으로 커스텀 액션
 *
 * `.cr-shell` 하위에서만 활성. flex column 의 마지막 자식으로 배치되어 viewport 하단 고정.
 */
export function CreationFooter({
  currentStep,
  onBack,
  backDisabled = false,
  onNext,
  nextLabel = '다음으로',
  nextDisabled,
  autoSaved = false,
  rightSlot,
}: CreationFooterProps) {
  const total = MAX_STEP

  return (
    <div className="cr-bottombar">
      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled}
        className="cr-btn-back"
        aria-label="이전 단계"
        aria-disabled={backDisabled}
        style={backDisabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
      >
        <ArrowLeft className="w-4 h-4" /> 이전
      </button>

      <div className="cr-pg-counter">
        <span className="num">{currentStep}</span> / {total} 단계
        {autoSaved && (
          <span
            style={{
              marginLeft: 10,
              fontFamily: 'var(--cr-font-gaegu)',
              fontSize: 16,
              color: 'var(--cr-sage-deep)',
              fontWeight: 700,
            }}
          >
            · 자동 저장됨
          </span>
        )}
      </div>

      {rightSlot ? (
        <div className="shrink-0 flex items-center gap-2 justify-self-end">{rightSlot}</div>
      ) : onNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="cr-btn-next"
        >
          <span>{nextLabel}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      ) : (
        <div aria-hidden="true" />
      )}
    </div>
  )
}
