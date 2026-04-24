import { useEffect, useState } from 'react'
import type { Person } from '../../../../entities/person'

type PersonDraft = Omit<Person, 'id' | 'userId'>
type Gender = NonNullable<Person['gender']>

interface Props {
  initial?: Person // 있으면 편집, 없으면 신규
  onClose: () => void
  onSave: (draft: PersonDraft) => void
}

// ── 날짜 헬퍼 ─────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1919 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

function parseBirthDate(date?: string) {
  if (!date) return { year: '', month: '', day: '' }
  const [y, m, d] = date.split('-')
  return {
    year: y ?? '',
    month: m ? String(parseInt(m, 10)) : '',
    day: d ? String(parseInt(d, 10)) : '',
  }
}

/**
 * 주인공 추가/편집 모달.
 * 생년월일은 브라우저 네이티브 date input 대신 년·월·일 커스텀 셀렉트 사용.
 * 이유: native input[type=date] 는 다크 배경에서 스타일 제어 불가, 월별 일 수 자동 보정도 직접 처리.
 */
export function PersonEditModal({ initial, onClose, onSave }: Props) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [gender, setGender] = useState<Gender | ''>(initial?.gender ?? '')

  const init = parseBirthDate(initial?.birthDate)
  const [birthYear, setBirthYear] = useState(init.year)
  const [birthMonth, setBirthMonth] = useState(init.month)
  const [birthDay, setBirthDay] = useState(init.day)

  // 월/년도가 바뀌어 선택한 일이 범위를 벗어나면 마지막 날로 보정
  const daysInMonth =
    birthYear && birthMonth
      ? getDaysInMonth(parseInt(birthYear, 10), parseInt(birthMonth, 10))
      : 31
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  useEffect(() => {
    if (birthDay && parseInt(birthDay, 10) > daysInMonth) {
      setBirthDay(String(daysInMonth))
    }
  }, [daysInMonth, birthDay])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!gender || !birthYear || !birthMonth || !birthDay) return
    const mm = String(birthMonth).padStart(2, '0')
    const dd = String(birthDay).padStart(2, '0')
    onSave({
      name: name.trim(),
      birthDate: `${birthYear}-${mm}-${dd}`,
      gender,
      role: 'child',
    })
  }

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'male', label: '남' },
    { value: 'female', label: '여' },
  ]

  // 셀렉트 공통 클래스
  const selectBase =
    'w-full px-2 py-2 rounded-lg bg-[#1a0f08] border border-[#4a3a24] ' +
    'text-[#e4d4b4] text-sm text-center ' +
    'focus:border-[#3ca55c] focus:outline-none ' +
    'hover:border-[#6a5a44] transition-colors ' +
    '[color-scheme:dark] cursor-pointer appearance-none'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[#2a1b12] border border-[#4a3a24] p-6 space-y-4"
      >
        <h2 className="text-xl font-bold text-[#e4d4b4]">
          {isEdit ? '주인공 편집' : '주인공 추가'}
        </h2>

        {/* 이름 */}
        <label className="block space-y-1">
          <span className="text-sm text-[#b4c4a4]">이름</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="예: 김별"
            className="w-full px-3 py-2 rounded-lg bg-[#1a0f08] border border-[#4a3a24] text-[#e4d4b4] focus:border-[#3ca55c] focus:outline-none"
          />
        </label>

        {/* 생년월일 — 년·월·일 커스텀 셀렉트 */}
        <div className="space-y-2">
          <span className="text-sm text-[#b4c4a4] flex items-center gap-1.5">
            <span aria-hidden="true">🎂</span>
            생년월일
          </span>

          <div className="flex gap-2">
            {/* 년도 */}
            <div className="relative flex-[5]">
              <select
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                required
                aria-label="출생 년도"
                className={selectBase + ' pr-6'}
              >
                <option value="" disabled>년도</option>
                {YEARS.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}년
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#6a5a44] text-[10px]" aria-hidden="true">
                ▼
              </span>
            </div>

            {/* 월 */}
            <div className="relative flex-[3]">
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                required
                aria-label="출생 월"
                className={selectBase + ' pr-6'}
              >
                <option value="" disabled>월</option>
                {MONTHS.map((m) => (
                  <option key={m} value={String(m)}>
                    {MONTH_LABELS[m - 1]}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#6a5a44] text-[10px]" aria-hidden="true">
                ▼
              </span>
            </div>

            {/* 일 — 년+월 선택 전까지 비활성 */}
            <div className="relative flex-[3]">
              <select
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                required
                disabled={!birthYear || !birthMonth}
                aria-label="출생 일"
                className={selectBase + ' pr-6 disabled:opacity-40 disabled:cursor-not-allowed'}
              >
                <option value="" disabled>일</option>
                {days.map((d) => (
                  <option key={d} value={String(d)}>
                    {d}일
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#6a5a44] text-[10px]" aria-hidden="true">
                ▼
              </span>
            </div>
          </div>

          {/* 선택된 날짜 미리보기 */}
          {birthYear && birthMonth && birthDay && (
            <p className="text-xs text-[#3ca55c] pl-1">
              {birthYear}년 {MONTH_LABELS[parseInt(birthMonth, 10) - 1]} {birthDay}일
            </p>
          )}
        </div>

        {/* 성별 */}
        <fieldset className="space-y-1">
          <legend className="text-sm text-[#b4c4a4]">성별</legend>
          <div className="grid grid-cols-2 gap-2">
            {genderOptions.map((opt) => {
              const selected = gender === opt.value
              return (
                <label
                  key={opt.value}
                  className={`px-3 py-2 rounded-lg border text-sm text-center cursor-pointer transition-colors ${
                    selected
                      ? 'border-[#3ca55c] bg-[#3ca55c]/15 text-[#3ca55c]'
                      : 'border-[#4a3a24] text-[#b4c4a4] hover:border-[#6a5a44]'
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
            className="flex-1 px-4 py-2 rounded-lg border border-[#4a3a24] text-[#b4c4a4] hover:bg-[#4a3a24] transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-[#3ca55c] text-[#1a0f08] font-medium hover:bg-[#4cb56c] transition-colors"
          >
            {isEdit ? '저장' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}
