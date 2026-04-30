import { useEffect, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Person } from '../../../../entities/person'

type PersonDraft = Omit<Person, 'id' | 'userId'>
type Gender = NonNullable<Person['gender']>

interface Props {
  initial?: Person // 있으면 편집, 없으면 신규
  onClose: () => void
  onSave: (draft: PersonDraft) => void
}

const MIN_AGE = 0
const MAX_AGE = 99

/**
 * 주인공 추가/편집 모달 — Pastel Forest 톤.
 * 생년월일 대신 만 나이 (0..99) 만 입력 — V10 마이그레이션으로 BE 도 age 컬럼만 보유.
 */
export function PersonEditModal({ initial, onClose, onSave }: Props) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [gender, setGender] = useState<Gender | ''>(initial?.gender ?? '')
  const [age, setAge] = useState<string>(initial?.age != null ? String(initial.age) : '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!gender) return
    const parsedAge = Number.parseInt(age, 10)
    if (!Number.isFinite(parsedAge) || parsedAge < MIN_AGE || parsedAge > MAX_AGE) return
    onSave({
      name: name.trim(),
      age: parsedAge,
      gender,
      role: 'child',
    })
  }

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'male', label: '남' },
    { value: 'female', label: '여' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 bg-[#3E2A18]/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-[#FFFEF8] border-2 border-[#B9D38F]/55 shadow-[0_12px_32px_rgba(154,117,72,0.25)] p-6 space-y-4"
      >
        <h2 className="text-xl font-bold text-[#3E2A18]">
          {isEdit ? '주인공 편집' : '주인공 추가'}
        </h2>

        {/* 이름 */}
        <label className="block space-y-1">
          <span className="text-sm text-[#6B4A28] font-bold">이름</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="예: 김별"
            className="w-full px-3 py-2 rounded-xl bg-[#F4E4BC]/60 border-2 border-[#9A7548]/40 text-[#3E2A18] font-bold placeholder-[#9A7548]/50 focus:border-[#3F6B2E] focus:outline-none"
          />
        </label>

        {/* 나이 — 직접 타이핑 + ↑↓ 버튼 */}
        <label className="block space-y-1">
          <span className="text-sm text-[#6B4A28] font-bold">나이 (만)</span>
          <AgeInput value={age} onChange={setAge} />
        </label>

        {/* 성별 */}
        <fieldset className="space-y-1">
          <legend className="text-sm text-[#6B4A28] font-bold">성별</legend>
          <div className="grid grid-cols-2 gap-2">
            {genderOptions.map((opt) => {
              const selected = gender === opt.value
              return (
                <label
                  key={opt.value}
                  className={`px-3 py-2 rounded-xl border-2 text-sm text-center cursor-pointer transition-colors font-bold ${
                    selected
                      ? 'border-[#3F6B2E] bg-[#B9D38F]/40 text-[#3F6B2E]'
                      : 'border-[#9A7548]/40 bg-[#F4E4BC]/60 text-[#6B4A28] hover:border-[#3F6B2E]/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setGender(opt.value)}
                    required
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-full border-2 border-[#9A7548]/40 text-[#3E2A18] font-bold bg-[#E9DBBE] hover:bg-[#D9BE82] transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2.5 rounded-full bg-[#8DBA64] text-[#1F3318] font-bold border border-[#B9D38F] shadow-[0_3px_0_#3F6B2E] hover:translate-y-0.5 hover:shadow-[0_1px_0_#3F6B2E] hover:bg-[#A6CB45] transition-all"
          >
            {isEdit ? '저장' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ============================================================================
 * AgeInput — 직접 타이핑 + 우측 ↑↓ 버튼.
 * 빈 문자열은 타이핑 transient 로 허용 (제출 시점에 검증).
 * ChildrenList 의 동명 컴포넌트와 디자인 일관성 유지.
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

  const inputStyle: CSSProperties = {
    // OS 기본 spinner 숨김 — Chrome/Safari (-webkit-) + Firefox (MozAppearance)
    MozAppearance: 'textfield',
  }

  return (
    <div className="relative min-w-0">
      <input
        type="number"
        inputMode="numeric"
        min={MIN_AGE}
        max={MAX_AGE}
        placeholder="예: 5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
        className="w-full px-3 py-2 pr-10 rounded-xl bg-[#F4E4BC]/60 border-2 border-[#9A7548]/40 text-[#3E2A18] font-bold placeholder-[#9A7548]/50 focus:border-[#3F6B2E] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="absolute right-[3px] top-[3px] bottom-[3px] w-7 flex flex-col border-l border-[#9A7548]/30 rounded-r-[10px] overflow-hidden">
        <button
          type="button"
          onClick={() => adjust(1)}
          aria-label="나이 한 살 늘리기"
          className="flex-1 flex items-center justify-center text-[#9A7548] hover:bg-[#D9BE82]/50 hover:text-[#6B4A28] active:bg-[#C9A874]/60 transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
        <div className="h-px bg-[#9A7548]/25" aria-hidden="true" />
        <button
          type="button"
          onClick={() => adjust(-1)}
          aria-label="나이 한 살 줄이기"
          className="flex-1 flex items-center justify-center text-[#9A7548] hover:bg-[#D9BE82]/50 hover:text-[#6B4A28] active:bg-[#C9A874]/60 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
