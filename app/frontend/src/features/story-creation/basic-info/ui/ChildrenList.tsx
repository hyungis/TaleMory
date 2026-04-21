import { ChevronDown, Minus, Plus } from 'lucide-react'
import type { ChildInfo, Gender } from '../../model/types'

const GENDERS: readonly Gender[] = ['남자', '여자'] as const

interface ChildrenListProps {
  children: ChildInfo[]
  onChildUpdate: (index: number, patch: Partial<ChildInfo>) => void
  onChildAdd: () => void
  onChildRemove: (index: number) => void
}

/**
 * 아이(주인공) 정보 다중 입력 리스트. 이름 / 성별 / 나이 + 추가/삭제 버튼.
 * - 마지막 행에는 (+) 추가 버튼, 그 외에는 (−) 삭제 버튼.
 */
export function ChildrenList({ children, onChildUpdate, onChildAdd, onChildRemove }: ChildrenListProps) {
  return (
    <div>
      <label className="block text-[#2d5a27] text-lg mb-2 font-bold">아이 정보</label>
      <div className="space-y-3">
        {children.map((child, idx) => {
          const isLast = idx === children.length - 1
          return (
            <div key={idx} className="grid grid-cols-[1.1fr_0.9fr_0.7fr_auto] gap-3">
              <input
                type="text"
                placeholder="이름"
                value={child.name}
                onChange={e => onChildUpdate(idx, { name: e.target.value })}
                className="min-w-0 p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-xl text-[#2d5a27] placeholder-[#8b7a52]/60"
              />
              <div className="relative">
                <select
                  value={child.gender}
                  onChange={e => onChildUpdate(idx, { gender: e.target.value as Gender })}
                  className="w-full appearance-none p-4 pr-12 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-lg text-[#2d5a27]"
                >
                  {GENDERS.map(g => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-5 h-5 text-[#8b7a52] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <input
                type="number"
                placeholder="나이"
                value={child.age}
                onChange={e => onChildUpdate(idx, { age: e.target.value })}
                className="min-w-0 p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-xl text-[#2d5a27] placeholder-[#8b7a52]/60"
              />
              {isLast ? (
                <button
                  type="button"
                  onClick={onChildAdd}
                  aria-label="아이 추가"
                  className="h-full min-h-[64px] aspect-square rounded-xl border-2 border-[#b4dc8c] bg-[#2d5a27] text-[#f0e6c0] hover:bg-[#3d6f34] hover:shadow-[0_0_14px_rgba(180,220,140,0.5)] transition-all flex items-center justify-center"
                >
                  <Plus className="w-6 h-6" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onChildRemove(idx)}
                  aria-label="아이 삭제"
                  className="h-full min-h-[64px] aspect-square rounded-xl border-2 border-[#8b3a2a] bg-[#8b3a2a] text-[#f0e6c0] hover:bg-[#a84a35] hover:shadow-[0_0_14px_rgba(201,123,74,0.5)] transition-all flex items-center justify-center"
                >
                  <Minus className="w-6 h-6" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
