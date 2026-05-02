import type { Level } from '../../model/types'

const LEVELS: readonly Level[] = ['초급', '중급', '고급'] as const

interface LevelPickerProps {
  value: Level
  onChange: (level: Level) => void
  /** 잠금 상태 시 모든 버튼 disabled (예: SUMMARY 락). */
  disabled?: boolean
}

/**
 * 3-column 난이도 선택 — paper-craft segmented control.
 * `.cr-seg` 클래스로 active(`.on`) 상태 시 sage-darker 배경 + cream 글자.
 */
export function LevelPicker({ value, onChange, disabled = false }: LevelPickerProps) {
  return (
    <div className="cr-field">
      <label className="cr-label">
        난이도 <span className="star">*</span>
      </label>
      <div className="cr-seg">
        {LEVELS.map(lv => (
          <button
            key={lv}
            type="button"
            onClick={() => onChange(lv)}
            disabled={disabled}
            className={value === lv ? 'on' : ''}
            aria-pressed={value === lv}
          >
            {lv}
          </button>
        ))}
      </div>
    </div>
  )
}
