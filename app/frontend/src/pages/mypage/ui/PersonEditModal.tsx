import { useEffect, useState } from 'react'
import type { Person } from '../../../entities/person'

type PersonDraft = Omit<Person, 'id' | 'userId'>
type Gender = NonNullable<Person['gender']>

interface Props {
  initial?: Person // 있으면 편집, 없으면 신규
  onClose: () => void
  onSave: (draft: PersonDraft) => void
}

/**
 * 주인공 추가/편집 모달.
 * 마이페이지는 주인공(role='child') 만 관리 — 역할 선택 UI 없음.
 * 필수: name, birthDate, gender.
 */
export function PersonEditModal({ initial, onClose, onSave }: Props) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '')
  const [gender, setGender] = useState<Gender | ''>(initial?.gender ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // HTML native validation 이 required 를 걸러주므로 이 시점엔 전부 채워진 상태.
    if (!gender) return
    onSave({
      name: name.trim(),
      birthDate,
      gender,
      role: 'child',
    })
  }

  // 마이페이지에선 '기타' 옵션 미제공 — 주인공 성별은 남/여 로만 선택.
  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'male', label: '남' },
    { value: 'female', label: '여' },
  ]

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

        <label className="block space-y-1">
          <span className="text-sm text-[#b4c4a4]">생년월일</span>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-[#1a0f08] border border-[#4a3a24] text-[#e4d4b4] focus:border-[#3ca55c] focus:outline-none"
          />
        </label>

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
                  {/* 네이티브 radio 숨김 — required 로 브라우저 기본 validation 적용. */}
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
