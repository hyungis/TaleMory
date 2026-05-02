import { useEffect } from 'react'

interface Props {
  onClose: () => void
  onConfirm: () => void
  isPending?: boolean
}

/**
 * 회원 탈퇴 confirm 다이얼로그 — paper-craft 톤 (rust 강조).
 */
export function WithdrawDialog({ onClose, onConfirm, isPending = false }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        onClose()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPending, onClose])

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
      <div
        onClick={event => event.stopPropagation()}
        className="mp-modal mp-modal--danger"
        role="alertdialog"
        aria-labelledby="withdraw-title"
        style={{ maxWidth: 420 }}
      >
        <h3 id="withdraw-title">정말 탈퇴하시겠어요?</h3>
        <p className="mp-modal-text">
          탈퇴하시면 <strong>계정 이용이 즉시 중단</strong>되고 모든 동화책·주인공·목소리에 접근할 수 없어요.
          <br />
          단, <span className="mp-emph">3개월 안</span>에 다시 로그인하시면 모든 정보를 그대로 복구할 수 있어요.
        </p>

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
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="mp-btn mp-btn-rust"
            style={{
              background: '#c47254',
              color: '#fdf6dc',
              borderColor: '#8a4a32',
              boxShadow: '0 3px 0 #8a4a32, 0 6px 12px rgba(140, 60, 40, 0.25)',
              padding: '10px 20px',
              fontSize: 18,
            }}
          >
            {isPending ? '탈퇴 처리 중...' : '탈퇴하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
