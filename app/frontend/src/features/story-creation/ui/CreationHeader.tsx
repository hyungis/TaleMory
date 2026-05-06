import { Fragment } from 'react'
import { Check } from 'lucide-react'
import { MAX_STEP } from '../model/types'

interface CreationHeaderProps {
  /** 현재 단계 (1 ~ MAX_STEP). */
  currentStep: number
}

/**
 * 동화 제작 플로우 공통 상단 헤더 — paper-craft 톤 (Claude offline.html 1:1).
 *
 * 구성:
 *  - 좌측: TaleMory 워드마크 + verticalDivider
 *  - 가운데: 9-dot progress (idle / done / active 3-state) + 점선 connector
 *  - 우측: "01 / 09" Nanum Myeongjo pill counter
 *
 * `.cr-shell` 하위에서만 활성화되며, 각 step 의 sticky topbar 로 동작.
 */
export function CreationHeader({ currentStep }: CreationHeaderProps) {
  const total = MAX_STEP
  const paddedCurrent = String(currentStep).padStart(2, '0')
  const paddedTotal = String(total).padStart(2, '0')

  return (
    <div className="cr-topbar">
      <div className="cr-brand-wrap">
        <span className="cr-brand">
          Tale<span className="accent">Mory</span>
        </span>
        <span className="cr-brand-divider" aria-hidden="true" />
      </div>

      <div className="cr-progress" role="list" aria-label="진행 단계">
        {Array.from({ length: total }, (_, i) => i + 1).map(step => {
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep
          const stateClass = isCompleted ? 'done' : isCurrent ? 'active' : ''
          return (
            <Fragment key={step}>
              <div
                className={`cr-pstep ${stateClass}`}
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className="cr-pdot"
                  aria-label={`단계 ${step}${isCurrent ? ' (현재)' : isCompleted ? ' (완료)' : ''}`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : step}
                </div>
                <div className="cr-pline" aria-hidden="true" />
              </div>
            </Fragment>
          )
        })}
      </div>

      <div className="cr-pcounter" aria-hidden="true">
        {paddedCurrent} / {paddedTotal}
      </div>
    </div>
  )
}
