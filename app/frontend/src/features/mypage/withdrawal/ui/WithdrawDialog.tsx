import { useEffect } from 'react'

interface Props {
  onClose: () => void
  onConfirm: () => void
}

/**
 * 회원 탈퇴 재확인 다이얼로그.
 * 디자인 결정: OAuth 재인증 없음, 단일 재확인 클릭으로 진행.
 *
 * 문구 톤: soft delete 구조라 DB row 는 남지만 사용자 관점에선 이용이 중단되는 것이 사실.
 * "즉시 삭제/복구 불가" 같은 표현은 지양 — 재가입/고객지원 복구 정책 확정 전까지 중립 유지.
 */
export function WithdrawDialog({ onClose, onConfirm }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-[#2a1b12] border border-[#e85c5c] p-6 space-y-4"
        role="alertdialog"
        aria-labelledby="withdraw-title"
      >
        <h2 id="withdraw-title" className="text-xl font-bold text-[#e85c5c]">
          정말 탈퇴하시겠어요?
        </h2>
        <p className="text-sm text-[#b4c4a4] leading-relaxed">
          탈퇴하시면 <strong className="text-[#e4d4b4]">계정 이용이 즉시 중단</strong>되고, 모든 동화책·주인공·목소리에 더 이상 접근할 수 없어요.
        </p>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-[#4a3a24] text-[#b4c4a4] hover:bg-[#4a3a24] transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-[#e85c5c] text-[#1a0f08] font-medium hover:bg-[#f36c6c] transition-colors"
          >
            탈퇴하기
          </button>
        </div>
      </div>
    </div>
  )
}
