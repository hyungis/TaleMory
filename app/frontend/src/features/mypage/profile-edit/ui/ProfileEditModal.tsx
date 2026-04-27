import { useEffect, useState } from 'react'
import type { UserProfile } from '../../../../entities/user'

interface Props {
  user: UserProfile
  onClose: () => void
  onSave: (patch: Pick<UserProfile, 'name' | 'nickname' | 'phone' | 'agreeSms' | 'agreeMarketing'>) => void
  isPending?: boolean
}

export function ProfileEditModal({ user, onClose, onSave, isPending = false }: Props) {
  const [name, setName] = useState(user.name)
  const [nickname, setNickname] = useState(user.nickname)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [agreeSms, setAgreeSms] = useState(user.agreeSms)
  const [agreeMarketing, setAgreeMarketing] = useState(user.agreeMarketing)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        onClose()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPending, onClose])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
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
      onClick={() => {
        if (!isPending) {
          onClose()
        }
      }}
      role="presentation"
    >
      <form
        onSubmit={handleSubmit}
        onClick={event => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[#2a1b12] border border-[#4a3a24] p-6 space-y-4"
      >
        <h2 className="text-xl font-bold text-[#e4d4b4]">프로필 수정</h2>

        <Field label="이름">
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            required
            disabled={isPending}
            className="w-full px-3 py-2 rounded-lg bg-[#1a0f08] border border-[#4a3a24] text-[#e4d4b4] focus:border-[#3ca55c] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </Field>

        <Field label="닉네임">
          <input
            value={nickname}
            onChange={event => setNickname(event.target.value)}
            required
            disabled={isPending}
            className="w-full px-3 py-2 rounded-lg bg-[#1a0f08] border border-[#4a3a24] text-[#e4d4b4] focus:border-[#3ca55c] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </Field>

        <Field label="전화번호">
          <input
            value={phone}
            onChange={event => setPhone(event.target.value)}
            placeholder="010-0000-0000"
            disabled={isPending}
            className="w-full px-3 py-2 rounded-lg bg-[#1a0f08] border border-[#4a3a24] text-[#e4d4b4] focus:border-[#3ca55c] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </Field>

        <div className="space-y-2 pt-2">
          <Toggle
            label="SMS 수신 동의"
            checked={agreeSms}
            onChange={setAgreeSms}
            isPending={isPending}
          />
          <Toggle
            label="마케팅 정보 수신 동의"
            checked={agreeMarketing}
            onChange={setAgreeMarketing}
            isPending={isPending}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-lg border border-[#4a3a24] text-[#b4c4a4] hover:bg-[#4a3a24] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-[#3ca55c] text-[#1a0f08] font-medium hover:bg-[#4cb56c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? '저장 중...' : '저장'}
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
  isPending = false,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  isPending?: boolean
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-[#e4d4b4]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={isPending}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-[#3ca55c]' : 'bg-[#4a3a24]'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
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
