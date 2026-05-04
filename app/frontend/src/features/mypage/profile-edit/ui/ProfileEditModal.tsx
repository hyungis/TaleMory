import { useEffect, useState } from 'react'
import type { UserProfile } from '../../../../entities/user'
import { formatPhoneNumber } from '../../../../shared/lib'

interface Props {
  user: UserProfile
  onClose: () => void
  onSave: (patch: Pick<UserProfile, 'name' | 'nickname' | 'phone' | 'agreeSms' | 'agreeMarketing'>) => void
  isPending?: boolean
}

/**
 * 프로필 편집 모달 — paper-craft 톤.
 */
export function ProfileEditModal({ user, onClose, onSave, isPending = false }: Props) {
  const [name, setName] = useState(user.name)
  const [nickname, setNickname] = useState(user.nickname)
  const [phone, setPhone] = useState(formatPhoneNumber(user.phone ?? ''))
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
      className="mp-modal-back"
      onClick={() => {
        if (!isPending) {
          onClose()
        }
      }}
      role="presentation"
    >
      <form onSubmit={handleSubmit} onClick={event => event.stopPropagation()} className="mp-modal">
        <h3>프로필 수정</h3>

        <Field label="이름">
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            required
            disabled={isPending}
            className="mp-input"
          />
        </Field>

        <Field label="닉네임">
          <input
            value={nickname}
            onChange={event => setNickname(event.target.value)}
            required
            disabled={isPending}
            className="mp-input"
          />
        </Field>

        <Field label="전화번호">
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={event => setPhone(formatPhoneNumber(event.target.value))}
            placeholder="010-0000-0000"
            disabled={isPending}
            className="mp-input"
          />
        </Field>

        <div style={{ paddingTop: 4 }}>
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

        <div className="mp-modal-actions">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="mp-btn mp-btn-cream"
          >
            취소
          </button>
          <button type="submit" disabled={isPending} className="mp-btn mp-btn-sage">
            {isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mp-field" style={{ display: 'block' }}>
      <span className="mp-field-label">{label}</span>
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
    <div className="mp-toggle-row">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={isPending}
        className={`mp-switch${checked ? ' on' : ''}`}
        aria-pressed={checked}
        aria-label={label}
      />
    </div>
  )
}
