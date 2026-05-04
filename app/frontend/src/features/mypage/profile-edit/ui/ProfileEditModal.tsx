import { useEffect, useState } from 'react'
import type { UserProfile } from '../../../../entities/user'
import { formatPhoneNumber } from '../../../../shared/lib'
import { getNicknameAvailability } from '../api/getNicknameAvailability'

interface Props {
  user: UserProfile
  onClose: () => void
  onSave: (patch: Pick<UserProfile, 'name' | 'nickname' | 'phone'>) => void
  isPending?: boolean
}

type NicknameCheckStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error'

interface NicknameCheckState {
  status: NicknameCheckStatus
  value: string
}

const INITIAL_NICKNAME_CHECK: NicknameCheckState = {
  status: 'idle',
  value: '',
}

function isNicknameConfirmed(
  state: NicknameCheckState,
  nickname: string,
  currentNickname: string,
): boolean {
  const normalizedNickname = nickname.trim()
  if (normalizedNickname === currentNickname.trim()) return true
  return state.status === 'available' && state.value === normalizedNickname
}

function getNicknameCheckMessage(
  state: NicknameCheckState,
  nickname: string,
  currentNickname: string,
): string | null {
  const normalizedNickname = nickname.trim()
  if (!normalizedNickname) return null
  if (normalizedNickname === currentNickname.trim()) return '현재 사용 중인 닉네임입니다.'
  if (state.status === 'idle' || state.value !== normalizedNickname) return '닉네임 중복확인을 해주세요.'
  if (state.status === 'checking') return '닉네임 중복확인 중입니다.'
  if (state.status === 'available') return '사용 가능한 닉네임입니다.'
  if (state.status === 'unavailable') return '이미 사용 중인 닉네임입니다.'
  return '닉네임 중복확인에 실패했습니다. 잠시 후 다시 시도해주세요.'
}

function getNicknameCheckMessageClassName(
  state: NicknameCheckState,
  nickname: string,
  currentNickname: string,
): string {
  const normalizedNickname = nickname.trim()
  if (!normalizedNickname) return 'mp-field-help'
  if (normalizedNickname === currentNickname.trim()) return 'mp-field-help mp-field-help--success'
  if (state.value !== normalizedNickname || state.status === 'idle' || state.status === 'checking') {
    return 'mp-field-help'
  }
  if (state.status === 'available') return 'mp-field-help mp-field-help--success'
  return 'mp-field-help mp-field-help--error'
}

/**
 * 프로필 편집 모달 — paper-craft 톤.
 */
export function ProfileEditModal({ user, onClose, onSave, isPending = false }: Props) {
  const [name, setName] = useState(user.name)
  const [nickname, setNickname] = useState(user.nickname)
  const [phone, setPhone] = useState(formatPhoneNumber(user.phone ?? ''))
  const [nicknameCheck, setNicknameCheck] = useState<NicknameCheckState>(INITIAL_NICKNAME_CHECK)

  const currentNickname = user.nickname.trim()
  const normalizedNickname = nickname.trim()
  const nicknameChanged = normalizedNickname !== currentNickname
  const nicknameCheckConfirmed = isNicknameConfirmed(nicknameCheck, nickname, user.nickname)
  const isNicknameCheckPending = nicknameCheck.status === 'checking'
  const nicknameCheckMessage = getNicknameCheckMessage(nicknameCheck, nickname, user.nickname)

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
    if (!nicknameCheckConfirmed) return

    onSave({
      name: name.trim(),
      nickname: normalizedNickname,
      phone: phone.trim() || null,
    })
  }

  const handleNicknameCheck = async () => {
    if (!normalizedNickname || !nicknameChanged || isPending || isNicknameCheckPending) return

    setNicknameCheck({ status: 'checking', value: normalizedNickname })

    try {
      const result = await getNicknameAvailability(normalizedNickname)
      setNicknameCheck({
        status: result.available ? 'available' : 'unavailable',
        value: normalizedNickname,
      })
    } catch {
      setNicknameCheck({ status: 'error', value: normalizedNickname })
    }
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
          <div className="mp-field-action-row">
            <input
              value={nickname}
              onChange={event => {
                setNickname(event.target.value)
                setNicknameCheck(INITIAL_NICKNAME_CHECK)
              }}
              required
              disabled={isPending}
              className="mp-input"
            />
            <button
              type="button"
              onClick={handleNicknameCheck}
              disabled={isPending || isNicknameCheckPending || !normalizedNickname || !nicknameChanged}
              className="mp-inline-check-btn"
            >
              {isNicknameCheckPending ? '확인 중' : '중복확인'}
            </button>
          </div>
          {nicknameCheckMessage && (
            <p className={getNicknameCheckMessageClassName(nicknameCheck, nickname, user.nickname)}>
              {nicknameCheckMessage}
            </p>
          )}
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

        <div className="mp-modal-actions">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="mp-btn mp-btn-cream"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending || !nicknameCheckConfirmed}
            className="mp-btn mp-btn-sage"
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
    <label className="mp-field" style={{ display: 'block' }}>
      <span className="mp-field-label">{label}</span>
      {children}
    </label>
  )
}
