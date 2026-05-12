import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Person } from '../../../../entities/person'

type PersonDraft = Omit<Person, 'id' | 'userId'>
type Gender = NonNullable<Person['gender']>

interface Props {
  initial?: Person // 있으면 편집, 없으면 신규
  onClose: () => void
  onSave: (draft: PersonDraft) => void
}

const MIN_AGE = 1
const MAX_AGE = 18
const INTEGER_PATTERN = /^\d+$/

/**
 * 주인공 추가/편집 모달 — paper-craft 톤.
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
    if (!INTEGER_PATTERN.test(age.trim())) return
    const parsedAge = Number(age.trim())
    if (!Number.isInteger(parsedAge) || parsedAge < MIN_AGE || parsedAge > MAX_AGE) return
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
    <div className="mp-modal-back" onClick={onClose} role="presentation">
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="mp-modal">
        <h3>{isEdit ? '주인공 편집' : '주인공 추가'}</h3>

        {/* 이름 */}
        <label className="mp-field" style={{ display: 'block' }}>
          <span className="mp-field-label">이름</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="예: 김별"
            className="mp-input"
          />
        </label>

        {/* 나이 */}
        <label className="mp-field" style={{ display: 'block' }}>
          <span className="mp-field-label">나이 (만)</span>
          <AgeInput value={age} onChange={setAge} />
        </label>

        {/* 성별 */}
        <fieldset className="mp-field" style={{ border: 'none', padding: 0, margin: 0, marginBottom: 14 }}>
          <legend className="mp-field-label" style={{ padding: 0 }}>성별</legend>
          <div className="mp-seg-radio">
            {genderOptions.map((opt) => {
              const selected = gender === opt.value
              return (
                <label key={opt.value} className={selected ? 'active' : ''}>
                  <input
                    type="radio"
                    name="gender"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setGender(opt.value)}
                    required
                    className="sr-only"
                    style={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      padding: 0,
                      margin: -1,
                      overflow: 'hidden',
                      clip: 'rect(0,0,0,0)',
                      border: 0,
                    }}
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="mp-modal-actions">
          <button type="button" onClick={onClose} className="mp-btn mp-btn-cream">
            취소
          </button>
          <button type="submit" className="mp-btn mp-btn-sage">
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

  const handleChange = (next: string) => {
    if (next === '' || INTEGER_PATTERN.test(next)) {
      onChange(next)
    }
  }

  return (
    <div className="mp-age-wrap">
      <input
        type="number"
        inputMode="numeric"
        step={1}
        min={MIN_AGE}
        max={MAX_AGE}
        placeholder="예: 5"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="mp-input"
      />
      <div className="mp-age-steppers">
        <button type="button" onClick={() => adjust(1)} aria-label="나이 한 살 늘리기">
          <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
        <div className="mp-age-step-divider" aria-hidden="true" />
        <button type="button" onClick={() => adjust(-1)} aria-label="나이 한 살 줄이기">
          <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
