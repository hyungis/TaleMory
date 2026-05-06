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
 * 아이(주인공) 정보 다중 입력 리스트 — paper-craft 톤.
 *
 * - 상단: "저장된 아이 불러오기" 커스텀 팝오버 (네이티브 select 대신).
 * - 각 행: 이름 / 성별 / 나이 + 마지막 행은 (+) 추가, 그 외는 (−) 삭제.
 * - 나이 input: OS 기본 spinner 대신 paper-craft ↑↓ 스테퍼.
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
  const loadedPersonIds = new Set(
    children.map(c => c.personId).filter((v): v is number => typeof v === 'number'),
  )
  const selectablePersons = (existingPersons ?? []).filter(p => !loadedPersonIds.has(p.id))

  return (
    <div className="cr-field">
      <label className="cr-label">
        아이 정보 <span className="star">*</span>
      </label>

      {onLoadPerson && (
        <SavedChildPicker
          persons={selectablePersons}
          onPick={onLoadPerson}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children.map((child, idx) => {
          const isLast = idx === children.length - 1
          return (
            <div key={idx} className="cr-row">
              <input
                type="text"
                placeholder="이름"
                value={child.name}
                onChange={e => onChildUpdate(idx, { name: e.target.value })}
                className="cr-input"
              />
              <select
                value={child.gender}
                onChange={e => onChildUpdate(idx, { gender: e.target.value as Gender })}
                className="cr-select"
              >
                {GENDERS.map(g => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <AgeInput
                value={child.age}
                onChange={next => onChildUpdate(idx, { age: next })}
              />
              {isLast ? (
                <button
                  type="button"
                  onClick={onChildAdd}
                  aria-label="아이 추가"
                  className="cr-icon-btn-add"
                  title="아이 추가"
                >
                  <Plus className="w-5 h-5" strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onChildRemove(idx)}
                  aria-label="아이 삭제"
                  className="cr-icon-btn-remove"
                  title="아이 삭제"
                >
                  <Minus className="w-5 h-5" strokeWidth={2.5} />
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
 * SavedChildPicker — paper-craft 커스텀 팝오버
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
    <div
      ref={containerRef}
      style={{ position: 'relative', marginBottom: 12 }}
    >
      <div className="cr-input-icon-wrap">
        <span className="cr-icon" aria-hidden="true">
          <User className="w-4 h-4" />
        </span>
        <button
          type="button"
          onClick={() => !isEmpty && setIsOpen(o => !o)}
          disabled={isEmpty}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className="cr-select"
          style={{
            textAlign: 'left',
            cursor: isEmpty ? 'not-allowed' : 'pointer',
            opacity: isEmpty ? 0.6 : 1,
          }}
        >
          {isEmpty ? '저장된 아이가 없습니다' : '저장된 아이 불러오기'}
        </button>
      </div>

      {isOpen && !isEmpty && (
        <ul
          role="listbox"
          aria-label="저장된 아이 목록"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 30,
            background: '#fdf6dc',
            border: '2px solid var(--cr-caramel-deep)',
            borderRadius: 14,
            boxShadow: '0 3px 0 var(--cr-caramel-deep), 0 8px 18px rgba(140,100,60,0.22)',
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
            listStyle: 'none',
            padding: 4,
            margin: 0,
          }}
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
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 0,
                  borderRadius: 10,
                  fontFamily: 'var(--cr-font-gaegu)',
                  fontWeight: 700,
                  fontSize: 18,
                  color: 'var(--cr-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(122, 153, 104, 0.18)'
                  e.currentTarget.style.color = 'var(--cr-sage-deep)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--cr-ink)'
                }}
              >
                <User className="w-4 h-4" style={{ color: 'var(--cr-caramel-deep)' }} />
                <span>
                  {p.name} <span style={{ opacity: 0.7 }}>({p.age}세)</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ============================================================================
 * AgeInput — input 안 우측 ↑↓ 스테퍼 (paper-craft 톤)
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
    <div className="cr-age-wrap">
      <input
        type="number"
        inputMode="numeric"
        min={MIN_AGE}
        max={MAX_AGE}
        placeholder="나이"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="cr-input"
      />
      <div className="cr-age-steppers" aria-hidden="true">
        <button
          type="button"
          onClick={() => adjust(1)}
          aria-label="나이 한 살 늘리기"
        >
          <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
        <div className="divider" />
        <button
          type="button"
          onClick={() => adjust(-1)}
          aria-label="나이 한 살 줄이기"
        >
          <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
