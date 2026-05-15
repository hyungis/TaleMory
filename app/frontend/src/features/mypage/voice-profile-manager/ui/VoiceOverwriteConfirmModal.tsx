import { useEffect } from 'react'

interface VoiceOverwriteConfirmModalProps {
  /** 충돌이 발생한 제목 — 안내 본문에 인용. */
  title: string
  /** [덮어쓰기] 진행 중 — 버튼 disabled + label 변경. */
  isSaving: boolean
  /** [덮어쓰기] 확정 — 호출부가 saveVoiceRecording({ overwrite: true }) 재호출. */
  onConfirm: () => void
  /** [다른 제목] 또는 ESC/배경 클릭 — 모달만 닫고 사용자가 input 으로 돌아간다. */
  onCancel: () => void
}

/**
 * 마이페이지 → "+ 목소리 추가" 페이지에서 동일 제목 충돌 (BE 409 / VOICE_004) 시 노출되는 확인 모달.
 *
 * 의도:
 *  - 같은 제목 보이스가 있을 때 무작정 막지 않고, 사용자가 [덮어쓰기] 또는 [다른 제목 입력] 을 선택.
 *  - [덮어쓰기] 시 BE 는 in-place 로 audioUrl 만 교체 (voiceProfileId 유지).
 *
 * 디자인:
 *  - mp-card / mp-btn-* 토큰 그대로 사용 — 마이페이지 화면 톤 통일.
 *  - 헤더에 ⚠ 아이콘 + rust 색 강조, 본문에 영향 안내 텍스트.
 */
export function VoiceOverwriteConfirmModal({
  title,
  isSaving,
  onConfirm,
  onCancel,
}: VoiceOverwriteConfirmModalProps) {
  // ESC 닫기 — 저장 중에는 무시.
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
      aria-labelledby="mypage-voice-overwrite-title"
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
        className="mp-card"
        style={{
          width: '100%',
          maxWidth: 460,
          padding: '22px 24px 18px',
          fontFamily: 'Gaegu, cursive',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#c0533b',
              color: '#fdf6dc',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 18,
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            !
          </span>
          <h3
            id="mypage-voice-overwrite-title"
            className="mp-card-title"
            style={{ margin: 0 }}
          >
            이미 같은 이름의 보이스가 있어요
          </h3>
        </div>

        <p
          style={{
            margin: '0 0 12px',
            fontSize: 16,
            color: 'var(--mp-ink-soft)',
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: 'var(--mp-ink)' }}>'{title}'</strong> 라는 제목의 보이스가
          이미 저장되어 있어요. 새 녹음으로 덮어쓰시겠어요?
        </p>
        <p
          style={{
            margin: '0 0 18px',
            fontSize: 14,
            color: 'var(--mp-ink-soft)',
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
            className="mp-btn mp-btn-cream"
            onClick={onCancel}
            disabled={isSaving}
          >
            다른 제목 입력
          </button>
          <button
            type="button"
            className="mp-btn mp-btn-sage"
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving ? '저장 중...' : '덮어쓰기'}
          </button>
        </div>
      </div>
    </div>
  )
}
