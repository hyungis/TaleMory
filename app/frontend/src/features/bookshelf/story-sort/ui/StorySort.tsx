import { ChevronDown } from 'lucide-react'
import type { SortKey } from '../lib/applySort'

interface StorySortProps {
  value: SortKey
  onChange: (value: SortKey) => void
}

/**
 * 정렬 드롭다운 — Claude 디자인 .sort pill.
 * `#f7eccd` bg + caramel-deep `#a37548` border + 손그림 입체 shadow.
 */
export function StorySort({ value, onChange }: StorySortProps) {
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={e => onChange(e.target.value as SortKey)}
        style={{
          appearance: 'none',
          fontFamily: 'var(--font-display)',
          fontSize: 17,
          fontWeight: 700,
          padding: '6px 32px 6px 16px',
          borderRadius: 999,
          border: '2px solid #a37548',
          background: '#f7eccd',
          color: '#4a3b2a',
          boxShadow: '0 2px 0 #a37548',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <option value="newest">최신순</option>
        <option value="oldest">오래된순</option>
        <option value="name">가나다순</option>
      </select>
      <ChevronDown
        className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
        style={{ color: '#4a3b2a' }}
        aria-hidden="true"
      />
    </div>
  )
}
