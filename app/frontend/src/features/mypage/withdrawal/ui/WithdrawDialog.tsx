import { useEffect } from 'react'

interface Props {
  onClose: () => void
  onConfirm: () => void
  isPending?: boolean
}

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
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={() => {
        if (!isPending) {
          onClose()
        }
      }}
      role="presentation"
    >
      <div
        onClick={event => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-[#2a1b12] border border-[#e85c5c] p-6 space-y-4"
        role="alertdialog"
        aria-labelledby="withdraw-title"
      >
        <h2 id="withdraw-title" className="text-xl font-bold text-[#e85c5c]">
          정말 탈퇴하시겠어요?
        </h2>
        <p className="text-sm text-[#b4c4a4] leading-relaxed">
          탈퇴하시면 <strong className="text-[#e4d4b4]">계정 이용이 즉시 중단</strong>되고,
          모든 동화책과 주인공, 목소리 정보에 더 이상 접근할 수 없어요.
        </p>

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
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-[#e85c5c] text-[#1a0f08] font-medium hover:bg-[#f36c6c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? '탈퇴 처리 중...' : '탈퇴하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
