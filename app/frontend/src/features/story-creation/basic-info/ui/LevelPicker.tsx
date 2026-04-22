import type { Level } from '../../model/types'

const LEVELS: readonly Level[] = ['초급', '중급', '고급'] as const

interface LevelPickerProps {
  value: Level
  onChange: (level: Level) => void
}

/** 3-column 난이도 선택 버튼 세트. */
export function LevelPicker({ value, onChange }: LevelPickerProps) {
  return (
    <div>
      <label className="block text-[#2d5a27] text-lg mb-3 font-bold">난이도</label>
      <div className="grid grid-cols-3 gap-3">
        {LEVELS.map(lv => (
          <button
            key={lv}
            type="button"
            onClick={() => onChange(lv)}
            className={`block text-center p-4 border-2 rounded-xl text-lg transition-all font-bold ${
              value === lv
                ? 'bg-[#2d5a27] border-[#b4dc8c] text-[#f0e6c0] shadow-[0_0_14px_rgba(180,220,140,0.45)]'
                : 'bg-[#e8ddb4] border-[#8b7a52]/60 text-[#8b7a52] hover:border-[#2d5a27] hover:text-[#2d5a27]'
            }`}
          >
            {lv}
          </button>
        ))}
      </div>
    </div>
  )
}
