import type { StoryLevel } from '../../../../entities/story'

const LEVELS: readonly StoryLevel[] = ['초급', '중급', '고급'] as const

interface StoryFilterProps {
  activeFilters: StoryLevel[]
  onToggle: (level: StoryLevel) => void
  /** "총 N 권" 표시용. */
  totalCount: number
}

/**
 * 난이도(초급/중급/고급) 다중 선택 칩.
 * - 빈 선택 = 전체 표시
 * - 총 권수 표시는 필터 바 좌측에 붙여 레이아웃을 묶음
 */
export function StoryFilter({ activeFilters, onToggle, totalCount }: StoryFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
      <div className="text-[#f0e6c0] text-lg font-bold whitespace-nowrap bg-[#2a1b12]/70 px-4 py-2 rounded-xl backdrop-blur-sm shadow-sm border border-[#4a3a24]">
        총 <span className="text-[#b4dc8c]">{totalCount}</span>권
      </div>
      <div className="flex gap-2 bg-[#2a1b12]/60 backdrop-blur-sm rounded-xl p-1.5 border border-[#4a3a24] shadow-sm">
        {LEVELS.map(level => {
          const isActive = activeFilters.includes(level)
          return (
            <button
              key={level}
              type="button"
              onClick={() => onToggle(level)}
              className={`filter-btn px-4 py-1.5 rounded-lg text-sm font-bold transition-all bg-transparent text-[#b4c4a4] border border-transparent hover:bg-[#2d5a27]/40 hover:text-[#f0e6c0] ${isActive ? 'active' : ''}`}
            >
              {level}
            </button>
          )
        })}
      </div>
    </div>
  )
}
