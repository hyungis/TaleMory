import { ChevronDown } from 'lucide-react'
import type { SortKey } from '../lib/applySort'

interface StorySortProps {
  value: SortKey
  onChange: (value: SortKey) => void
}

/**
 * 정렬 드롭다운 (최신순/오래된순/가나다순).
 *
 * 브라우저 기본 `<select>` 화살표가 OS 별로 위치 / 거리가 다르고 스타일링 불가능해
 * `appearance: none` 으로 끄고 lucide `ChevronDown` 을 absolute 로 배치.
 */
export function StorySort({ value, onChange }: StorySortProps) {
  return (
    <div className="flex gap-2 w-full md:w-auto justify-end">
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value as SortKey)}
          className="appearance-none bg-[#2a1b12]/70 backdrop-blur-sm border border-[#4a3a24] text-[#d6c78e] text-base rounded-xl py-2.5 pl-3 pr-9 outline-none cursor-pointer shadow-sm hover:border-[#6a5a44] transition-colors"
        >
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="name">가나다순</option>
        </select>
        <ChevronDown
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d6c78e] pointer-events-none"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
