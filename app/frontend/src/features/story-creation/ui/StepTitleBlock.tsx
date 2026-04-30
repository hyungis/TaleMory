interface StepTitleBlockProps {
  /** 현재 step 번호 (1 ~ MAX_STEP). */
  stepNumber: number
  /** 큰 한글 제목 — Gaegu 손글씨 톤. */
  title: string
  /** 보조 설명 한 줄. */
  subtitle?: string
}

/**
 * 각 step content 상단에 노출되는 공통 타이틀 블록.
 *
 * 구성:
 *  - "STEP 0N" tracking-wide uppercase 라벨
 *  - 큰 손글씨 톤 제목 (Gaegu)
 *  - 부제 한 줄 (옵션)
 *
 * StepHeader 와 별개 — 헤더 바는 진행 dots 만 표시하고,
 * 컨텐츠 영역 안에서 무엇을 입력하는 단계인지 사용자 친화적으로 안내한다.
 */
export function StepTitleBlock({ stepNumber, title, subtitle }: StepTitleBlockProps) {
  const padded = String(stepNumber).padStart(2, '0')
  return (
    <div className="mb-8">
      <p className="text-base sm:text-lg font-bold text-[#3F6B2E] tracking-[0.22em] uppercase mb-2">
        Step {padded}
      </p>
      <h2
        className="text-3xl md:text-4xl text-[#3E2A18] mb-2 font-bold"
        style={{
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.03em',
          lineHeight: 1.1,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="text-[#6B4A28] text-base md:text-lg">{subtitle}</p>
      )}
    </div>
  )
}
