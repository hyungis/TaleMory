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
      <div className="text-[#3E2A18] text-lg font-bold whitespace-nowrap bg-[#E9DBBE] px-4 py-2 rounded-xl shadow-sm border border-[#9A7548]/40">
        총 <span className="text-[#3F6B2E]">{totalCount}</span>권
      </div>
      <div className="flex gap-2 bg-[#E9DBBE] rounded-xl p-1.5 border border-[#9A7548]/40 shadow-sm">
        {LEVELS.map(level => {
          const isActive = activeFilters.includes(level)
          return (
            <button
              key={level}
              type="button"
              onClick={() => onToggle(level)}
              className={`filter-btn px-4 py-1.5 rounded-lg text-sm font-bold transition-all bg-transparent text-[#6B4A28] border border-transparent hover:bg-[#3F6B2E]/15 hover:text-[#3F6B2E] ${isActive ? 'active' : ''}`}
            >
              {level}
            </button>
          )
        })}
      </div>
    </div>
  )
}
