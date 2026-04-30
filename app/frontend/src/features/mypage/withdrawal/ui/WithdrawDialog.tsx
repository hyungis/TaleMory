import { useEffect } from 'react'

interface Props {
  onClose: () => void
  onConfirm: () => void
  isPending?: boolean
}

/**
 * 회원 탈퇴 confirm 다이얼로그 — Pastel Forest 톤 + dusty rose 강조.
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
      className="fixed inset-0 z-50 bg-[#3E2A18]/60 flex items-center justify-center p-4"
      onClick={() => {
        if (!isPending) {
          onClose()
        }
      }}
      role="presentation"
    >
      <div
        onClick={event => event.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-[#FFFEF8] border-2 border-[#D8857C] shadow-[0_12px_32px_rgba(154,117,72,0.25)] p-6 space-y-4"
        role="alertdialog"
        aria-labelledby="withdraw-title"
      >
        <h2 id="withdraw-title" className="text-xl font-bold text-[#a3413f]">
          정말 탈퇴하시겠어요?
        </h2>
        <p className="text-sm text-[#3E2A18] leading-relaxed">
          탈퇴하시면 <strong className="text-[#a3413f]">계정 이용이 즉시 중단</strong>되고
          모든 동화책·주인공·목소리에 접근할 수 없어요.
          <br />
          단, <strong className="text-[#3F6B2E]">3개월 안</strong> 에 다시 로그인하시면 모든 정보를 그대로 복구할 수 있어요.
        </p>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-full border-2 border-[#9A7548]/40 text-[#3E2A18] font-bold bg-[#E9DBBE] hover:bg-[#D9BE82] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-full bg-[#D8857C] text-[#FFFEF8] font-bold border border-[#a3413f] shadow-[0_3px_0_#7a2a20] hover:translate-y-0.5 hover:shadow-[0_1px_0_#7a2a20] hover:bg-[#c87a72] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_3px_0_#7a2a20]"
          >
            {isPending ? '탈퇴 처리 중...' : '탈퇴하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
