import { useEffect, useState } from 'react'
import type { UserProfile } from '../../../entities/user'

interface Props {
  user: UserProfile
  onClose: () => void
  onSave: (patch: Pick<UserProfile, 'name' | 'nickname' | 'phone' | 'agreeSms' | 'agreeMarketing'>) => void
}

/**
 * 프로필 편집 모달.
 * 편집 가능 필드: name, nickname, phone, agreeSms, agreeMarketing.
 * email / loginId / provider 는 읽기 전용 (변경 불가).
 */
export function ProfileEditModal({ user, onClose, onSave }: Props) {
  const [name, setName] = useState(user.name)
  const [nickname, setNickname] = useState(user.nickname)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [agreeSms, setAgreeSms] = useState(user.agreeSms)
  const [agreeMarketing, setAgreeMarketing] = useState(user.agreeMarketing)

  // Esc 키 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: name.trim(),
      nickname: nickname.trim(),
      phone: phone.trim() || null,
      agreeSms,
      agreeMarketing,
    })
  }

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
        <h2 className="text-xl font-bold text-[#e4d4b4]">프로필 편집</h2>

        <Field label="이름">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-[#1a0f08] border border-[#4a3a24] text-[#e4d4b4] focus:border-[#3ca55c] focus:outline-none"
          />
        </Field>
        <Field label="닉네임">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-[#1a0f08] border border-[#4a3a24] text-[#e4d4b4] focus:border-[#3ca55c] focus:outline-none"
          />
        </Field>
        <Field label="전화번호">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className="w-full px-3 py-2 rounded-lg bg-[#1a0f08] border border-[#4a3a24] text-[#e4d4b4] focus:border-[#3ca55c] focus:outline-none"
          />
        </Field>

        <div className="space-y-2 pt-2">
          <Toggle label="SMS 수신 동의" checked={agreeSms} onChange={setAgreeSms} />
          <Toggle label="마케팅 정보 수신 동의" checked={agreeMarketing} onChange={setAgreeMarketing} />
        </div>

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
            저장
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-[#b4c4a4]">{label}</span>
      {children}
    </label>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-[#e4d4b4]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-[#3ca55c]' : 'bg-[#4a3a24]'
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#e4d4b4] transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </label>
  )
}
