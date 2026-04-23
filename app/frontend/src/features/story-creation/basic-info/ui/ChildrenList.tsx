import { ChevronDown, Minus, Plus } from 'lucide-react'
import type { StoryChild, Gender } from '../../model/types'
import type { PersonResponse } from '../api/types'

const GENDERS: readonly Gender[] = ['남자', '여자'] as const

interface ChildrenListProps {
  children: StoryChild[]
  onChildUpdate: (index: number, patch: Partial<StoryChild>) => void
  onChildAdd: () => void
  onChildRemove: (index: number) => void
  /**
   * "저장된 아이 불러오기" 드롭다운용 — role=CHILD 로 조회된 기존 인물 목록.
   * undefined 또는 빈 배열이면 드롭다운 자체를 숨긴다.
   */
  existingPersons?: PersonResponse[]
  /** 드롭다운 선택 시 호출 — BasicInfoStep 이 mapper 로 StoryChild 변환 후 flow.appendChild 수행. */
  onLoadPerson?: (person: PersonResponse) => void
}

/**
 * 아이(주인공) 정보 다중 입력 리스트. 이름 / 성별 / 나이 + 추가/삭제 버튼.
 * - 상단: "저장된 아이 불러오기" 드롭다운 (기존 persons 재활용)
 * - 마지막 행: (+) 추가 버튼
 * - 그 외 행: (−) 삭제 버튼
 */
export function ChildrenList({
  children,
  onChildUpdate,
  onChildAdd,
  onChildRemove,
  existingPersons,
  onLoadPerson,
}: ChildrenListProps) {
  /** 현재 입력 중인 children 에 이미 포함된 personId 는 드롭다운 옵션에서 제외. */
  const loadedPersonIds = new Set(children.map(c => c.personId).filter((v): v is number => typeof v === 'number'))
  const selectablePersons = (existingPersons ?? []).filter(p => !loadedPersonIds.has(p.id))

  return (
    <div>
      <label className="block text-black text-lg mb-2 font-bold">아이 정보</label>

      {onLoadPerson && (
        <div className="mb-3">
          <div className="relative">
            <select
              value=""
              onChange={e => {
                const id = Number(e.target.value)
                const person = selectablePersons.find(p => p.id === id)
                if (person) onLoadPerson(person)
                e.currentTarget.value = ''
              }}
              className="w-full appearance-none p-3 pr-12 bg-[#f0e6c0] border-2 border-[#b4dc8c] rounded-xl focus:border-[#2d5a27] focus:outline-none text-base text-black font-bold cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={selectablePersons.length === 0}
            >
              <option value="" disabled>
                저장된 아이 불러오기
              </option>
              {selectablePersons.length === 0 ? (
                <option value="" disabled>
                  (저장된 아이가 없습니다)
                </option>
              ) : (
                selectablePersons.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="w-5 h-5 text-black absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

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
                className="min-w-0 p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-xl text-black placeholder-black/60"
              />
              <div className="relative">
                <select
                  value={child.gender}
                  onChange={e => onChildUpdate(idx, { gender: e.target.value as Gender })}
                  className="w-full appearance-none p-4 pr-12 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-lg text-black"
                >
                  {GENDERS.map(g => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-5 h-5 text-black absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <input
                type="number"
                placeholder="나이"
                value={child.age}
                onChange={e => onChildUpdate(idx, { age: e.target.value })}
                className="min-w-0 p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-xl text-black placeholder-black/60"
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
