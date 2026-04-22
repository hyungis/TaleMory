import type { SortKey } from '../lib/applySort'

interface StorySortProps {
  value: SortKey
  onChange: (value: SortKey) => void
}

/**
 * 정렬 드롭다운 (최신순/오래된순/가나다순).
 */
export function StorySort({ value, onChange }: StorySortProps) {
  return (
    <div className="flex gap-2 w-full md:w-auto justify-end">
      <select
        value={value}
        onChange={e => onChange(e.target.value as SortKey)}
        className="bg-[#2a1b12]/70 backdrop-blur-sm border border-[#4a3a24] text-[#d6c78e] text-base rounded-xl p-2.5 outline-none cursor-pointer shadow-sm"
      >
        <option value="newest">최신순</option>
        <option value="oldest">오래된순</option>
        <option value="name">가나다순</option>
      </select>
    </div>
  )
}
