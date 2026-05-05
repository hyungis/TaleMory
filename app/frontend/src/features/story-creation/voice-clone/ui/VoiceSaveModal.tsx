import { useEffect, useRef, useState } from 'react'
import { Save, X } from 'lucide-react'

interface VoiceSaveModalProps {
  /** 사용자가 직전에 녹음한 오디오의 dataURL — 초기 자동 제안 제목 생성에 사용 X (단순 표식). */
  recordedAt?: Date
  /** "저장 중..." 상태 — 모달이 input/버튼 disabled 처리. */
  isSaving: boolean
  /** "저장" 클릭 시 호출. 성공/실패는 호출부가 결정 (성공이면 onClose 까지 호출). */
  onSubmit: (title: string) => void | Promise<void>
  onClose: () => void
}

/**
 * 보이스 클론 — "녹음 저장" 모달.
 *
 * 사용자가 임의의 제목을 붙여 보이스 프로필을 BE 에 commit 하도록 한다.
 * 빈/공백 제목은 disabled — 호출부에서도 trim 검증.
 *
 * paper-craft 디자인 토큰(`--cr-*`) 그대로 사용 — Step 6 화면 톤 통일.
 */
export function VoiceSaveModal({ isSaving, onSubmit, onClose }: VoiceSaveModalProps) {
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // 모달 열릴 때 input 자동 포커스 — 사용자 클릭 1회 줄여줌.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ESC 닫기 — 저장 중에는 무시 (실수로 진행 끊지 않도록).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isSaving, onClose])

  const trimmed = title.trim()
  const canSubmit = trimmed.length > 0 && !isSaving

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    void onSubmit(trimmed)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-save-modal-title"
      onClick={() => {
        if (!isSaving) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(45, 30, 20, 0.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#fdf6dc',
          border: '2.5px solid var(--cr-caramel)',
          borderRadius: 18,
          padding: '22px 24px 18px',
          boxShadow: '0 8px 24px rgba(80, 50, 30, 0.25), 0 4px 0 var(--cr-caramel)',
          fontFamily: 'var(--cr-font-gaegu)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--cr-sage-darker)',
                color: '#fdf6dc',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Save className="w-4 h-4" />
            </span>
            <h3
              id="voice-save-modal-title"
              style={{
                fontFamily: 'var(--cr-font-serif)',
                fontWeight: 800,
                fontSize: 20,
                color: 'var(--cr-ink)',
                margin: 0,
                letterSpacing: '-0.5px',
              }}
            >
              녹음 저장하기
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="모달 닫기"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--cr-ink-soft)',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.4 : 1,
              padding: 4,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p
          style={{
            margin: '0 0 12px',
            fontSize: 14,
            color: 'var(--cr-ink-soft)',
          }}
        >
          이 녹음에 사용할 제목을 입력해 주세요. 나중에 "기존 음성 불러오기" 에서
          이 제목으로 다시 찾을 수 있어요.
        </p>

        <label
          className="cr-label"
          htmlFor="voice-save-modal-input"
          style={{ fontSize: 15 }}
        >
          제목
        </label>
        <input
          id="voice-save-modal-input"
          ref={inputRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="예: 엄마 제주 동화 목소리"
          maxLength={60}
          disabled={isSaving}
          className="cr-input"
          style={{ marginTop: 4 }}
        />

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 18,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="cr-btn-back"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="cr-btn-next"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? '저장 중...' : '저장'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
