import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus, User } from 'lucide-react'
import type { StoryChild, Gender } from '../../model/types'
import type { PersonResponse } from '../api/types'

const GENDERS: readonly Gender[] = ['남자', '여자'] as const
const MIN_AGE = 0
const MAX_AGE = 99

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
 *
 * - 상단: "저장된 아이 불러오기" 커스텀 팝오버 드롭다운 (네이티브 select 대신 — OS 톤 차이 회피)
 * - 마지막 행: (+) 추가 버튼
 * - 그 외 행: (−) 삭제 버튼
 * - 나이 input: 브라우저 기본 spinner 숨기고 커스텀 ↑↓ 버튼으로 1씩 증감 (0~99 클램프)
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
      <label className="block text-black text-2xl mb-2 font-bold">아이 정보</label>

      {onLoadPerson && (
        <SavedChildPicker
          persons={selectablePersons}
          onPick={onLoadPerson}
        />
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
              <AgeInput
                value={child.age}
                onChange={next => onChildUpdate(idx, { age: next })}
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

/* ============================================================================
 * SavedChildPicker — 커스텀 팝오버 드롭다운
 * --------------------------------------------------------------------------
 * 네이티브 <select> 의 OS-styled option list 가 우리 디자인 톤과 안 맞아서
 * trigger button + 절대 배치 popover 로 직접 구현. TravelDatePicker 와 같은 패턴.
 *
 * 동작:
 *  - 트리거 클릭 → 팝오버 토글
 *  - 외부 클릭 / Esc → 닫힘
 *  - 옵션 클릭 → onPick + 팝오버 닫힘
 *  - 비어있을 때는 트리거 자체가 disabled + 안내 문구
 * ========================================================================= */
function SavedChildPicker({
  persons,
  onPick,
}: {
  persons: PersonResponse[]
  onPick: (person: PersonResponse) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isEmpty = persons.length === 0

  useEffect(() => {
    if (!isOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative mb-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => !isEmpty && setIsOpen(o => !o)}
          disabled={isEmpty}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`w-full appearance-none p-4 pr-12 bg-[#e8ddb4] border-2 rounded-xl outline-none text-left text-lg flex items-center gap-2 transition-colors ${
            isEmpty
              ? 'border-[#8b7a52]/40 text-black/50 cursor-not-allowed'
              : 'border-[#8b7a52]/60 text-black focus:border-[#2d5a27] hover:border-[#2d5a27]/60'
          }`}
        >
          <User className="w-4 h-4 text-[#8b7a52] shrink-0" aria-hidden="true" />
          <span>{isEmpty ? '저장된 아이가 없습니다' : '저장된 아이 불러오기'}</span>
        </button>
        <ChevronDown
          className={`w-5 h-5 text-black absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </div>

      {isOpen && !isEmpty && (
        <ul
          role="listbox"
          aria-label="저장된 아이 목록"
          className="absolute top-full left-0 right-0 mt-2 z-30 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl shadow-[0_8px_24px_rgba(107,74,40,0.25)] overflow-hidden max-h-72 overflow-y-auto"
        >
          {persons.map(p => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                onClick={() => {
                  onPick(p)
                  setIsOpen(false)
                }}
                className="w-full px-4 py-3 text-left text-black hover:bg-[#D9BE82]/50 active:bg-[#C9A874]/60 transition-colors flex items-center gap-2 border-b border-[#8b7a52]/20 last:border-b-0"
              >
                <User className="w-4 h-4 text-[#8b7a52] shrink-0" aria-hidden="true" />
                <span className="font-bold">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ============================================================================
 * AgeInput — type=number 의 OS 기본 spinner 를 우리 톤의 ↑↓ 버튼으로 교체
 * --------------------------------------------------------------------------
 * - 브라우저 기본 spinner 는 bookshelf.css 에서 appearance: none 으로 숨김
 * - 우측 inset 영역에 작은 ↑↓ 버튼을 세로로 stack
 * - 버튼 클릭 = 1씩 증감, 0..99 로 클램프
 * - 직접 키보드 입력도 그대로 가능 (type=number 유지)
 * ========================================================================= */
function AgeInput({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const adjust = (delta: 1 | -1) => {
    const parsed = Number.parseInt(value, 10)
    const base = Number.isFinite(parsed) ? parsed : 0
    const next = Math.min(MAX_AGE, Math.max(MIN_AGE, base + delta))
    onChange(String(next))
  }

  return (
    <div className="relative min-w-0">
      <input
        type="number"
        inputMode="numeric"
        min={MIN_AGE}
        max={MAX_AGE}
        placeholder="나이"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full p-4 pr-12 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-xl text-black placeholder-black/60"
      />
      {/* 우측 ↑↓ spinner 칼럼 — input 높이 풀로 채우고 border 로 영역 구분.
          색은 input 보더(#8b7a52) 와 동일 톤 brown 으로 통일, hover 시 honey wash. */}
      <div className="absolute right-[3px] top-[3px] bottom-[3px] w-8 flex flex-col border-l border-[#8b7a52]/30 rounded-r-[10px] overflow-hidden">
        <button
          type="button"
          onClick={() => adjust(1)}
          aria-label="나이 한 살 늘리기"
          className="flex-1 flex items-center justify-center text-[#8b7a52] hover:bg-[#D9BE82]/50 hover:text-[#6B4A28] active:bg-[#C9A874]/60 transition-colors"
        >
          <ChevronUp className="w-4 h-4" strokeWidth={2.5} />
        </button>
        <div className="h-px bg-[#8b7a52]/25" aria-hidden="true" />
        <button
          type="button"
          onClick={() => adjust(-1)}
          aria-label="나이 한 살 줄이기"
          className="flex-1 flex items-center justify-center text-[#8b7a52] hover:bg-[#D9BE82]/50 hover:text-[#6B4A28] active:bg-[#C9A874]/60 transition-colors"
        >
          <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
