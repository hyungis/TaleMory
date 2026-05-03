interface StepTitleBlockProps {
  /** 현재 step 번호 (1 ~ MAX_STEP). */
  stepNumber: number
  /** 큰 한글 제목 — Nanum Myeongjo serif 톤. */
  title: string
  /** 보조 설명 한 줄 (옵션). */
  subtitle?: string
}

/**
 * 각 step content 상단의 공통 타이틀 블록 — paper-craft 톤.
 *
 * 구성:
 *  - "STEP 0N" sage tracking-wide 라벨
 *  - 큰 Nanum Myeongjo 38px 제목
 *  - 부제 한 줄 (Gaegu 17px ink-soft, 옵션)
 *
 * `.cr-shell` 하위에서만 활성. 헤더의 진행 dots 는 위치만 알려주고,
 * 이 블록이 본문 상단에서 "어떤 단계인지" 사용자 친화적 안내.
 */
export function StepTitleBlock({ stepNumber, title, subtitle }: StepTitleBlockProps) {
  const padded = String(stepNumber).padStart(2, '0')
  return (
    <div>
      <p className="cr-step-label">STEP {padded}</p>
      <h2 className="cr-step-title">{title}</h2>
      {subtitle && <p className="cr-step-sub">{subtitle}</p>}
    </div>
  )
}
