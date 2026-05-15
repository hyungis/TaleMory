import { useEffect } from 'react'
import { AlertTriangle, Save, X } from 'lucide-react'

interface VoiceOverwriteConfirmModalProps {
  /** 충돌이 발생한 제목 — "이미 '{title}' 보이스가 있어요" 안내에 사용. */
  title: string
  /** [덮어쓰기] 클릭 진행 중 표시 — 버튼 disabled + label 변경. */
  isSaving: boolean
  /** [덮어쓰기] 확정 — 호출부가 saveVoiceRecording(title, { overwrite: true }) 재호출. */
  onConfirm: () => void
  /** [다른 제목] 또는 ESC/배경 클릭 — 모달만 닫고 저장 모달의 input 으로 사용자가 돌아간다. */
  onCancel: () => void
}

/**
 * Step 6 보이스 저장 흐름에서 BE 가 409 DUPLICATE_TITLE 을 반환했을 때 띄우는 확인 모달.
 *
 * 의도:
 *  - 같은 제목의 보이스 프로필이 이미 있을 때 무작정 막지 않고, 사용자가 [덮어쓰기] 또는
 *    [다른 제목 입력] 을 선택하도록 안내한다.
 *  - [덮어쓰기] 시 BE 는 in-place 로 audioUrl 만 교체 (voiceProfileId 유지) — 기존 동화의
 *    voiceProfileId FK 가 그대로 유지되어 다음 TTS 생성 시 새 음성으로 자동 적용.
 *
 * 디자인:
 *  - VoiceSaveModal 과 동일한 paper-craft 톤 (--cr-* 토큰).
 *  - 헤더 아이콘은 rust 배경의 AlertTriangle — "주의" 신호.
 *  - 본문에 영향 안내 ("기존 보이스를 사용 중인 동화는 다음 TTS 생성 시 새 음성으로 바뀌어요").
 */
export function VoiceOverwriteConfirmModal({
  title,
  isSaving,
  onConfirm,
  onCancel,
}: VoiceOverwriteConfirmModalProps) {
  // ESC 닫기 — 저장 중에는 무시 (실수로 진행 끊지 않도록).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isSaving, onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-overwrite-modal-title"
      onClick={() => {
        if (!isSaving) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(45, 30, 20, 0.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 60,
        padding: 16,
      }}
    >
      <div
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
                background: 'var(--cr-rust)',
                color: '#fdf6dc',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h3
              id="voice-overwrite-modal-title"
              style={{
                fontFamily: 'var(--cr-font-serif)',
                fontWeight: 800,
                fontSize: 22,
                color: 'var(--cr-ink)',
                margin: 0,
                letterSpacing: '-0.5px',
              }}
            >
              이미 같은 이름의 보이스가 있어요
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
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
            margin: '0 0 14px',
            fontSize: 17,
            color: 'var(--cr-ink-soft)',
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: 'var(--cr-ink)' }}>'{title}'</strong> 라는 제목의 보이스가
          이미 저장되어 있어요. 새 녹음으로 덮어쓰시겠어요?
        </p>
        <p
          style={{
            margin: '0 0 18px',
            fontSize: 15,
            color: 'var(--cr-ink-soft)',
            lineHeight: 1.5,
            opacity: 0.85,
          }}
        >
          기존 보이스를 사용 중인 동화는 다음 TTS 생성 시 새 음성으로 바뀌어요.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="cr-btn-back"
          >
            다른 제목 입력
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="cr-btn-next"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? '저장 중...' : '덮어쓰기'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
