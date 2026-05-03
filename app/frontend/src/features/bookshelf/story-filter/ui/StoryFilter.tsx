import type { StoryLevel } from '../../../../entities/story'

const LEVELS: readonly StoryLevel[] = ['초급', '중급', '고급'] as const

interface StoryFilterProps {
  activeFilters: StoryLevel[]
  onToggle: (level: StoryLevel) => void
  /** "총 N 권" 표시용. */
  totalCount: number
}

/**
 * 책장 필터 — Claude 디자인 .chip / .chip-group 1:1.
 * 색상: chip bg `#f7eccd`, count bg `#efe1b6`, border `#a37548` (caramel-deep).
 * 활성 seg: caramel `#c89968` bg + white text + inset shadow.
 * 손그림 입체 box-shadow: `0 2px 0 #a37548` 으로 종이 위에 떠있는 느낌.
 */
export function StoryFilter({ activeFilters, onToggle, totalCount }: StoryFilterProps) {
  const chipBase: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 700,
    padding: '8px 18px',
    borderRadius: 999,
    border: '2px solid #a37548',
    color: '#4a3b2a',
    boxShadow: '0 2px 0 #a37548',
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* count chip */}
      <div style={{ ...chipBase, background: '#efe1b6' }}>
        총 {totalCount}권
      </div>

      {/* chip group — segmented */}
      <div
        className="flex items-center gap-0"
        style={{
          background: '#f7eccd',
          border: '2px solid #a37548',
          borderRadius: 999,
          padding: 4,
          boxShadow: '0 2px 0 #a37548',
        }}
      >
        {LEVELS.map(level => {
          const isActive = activeFilters.includes(level)
          return (
            <button
              key={level}
              type="button"
              onClick={() => onToggle(level)}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 17,
                fontWeight: 700,
                padding: '4px 16px',
                borderRadius: 999,
                border: 'none',
                background: isActive ? '#c89968' : 'transparent',
                color: isActive ? '#fff' : '#6b5638',
                boxShadow: isActive ? 'inset 0 -2px 0 rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {level}
            </button>
          )
        })}
      </div>
    </div>
  )
}
