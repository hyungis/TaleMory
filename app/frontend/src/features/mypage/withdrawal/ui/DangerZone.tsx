interface Props {
  onWithdrawClick: () => void
}

/**
 * 페이지 최하단 위험 영역.
 * 오발 방지를 위해 프로필 섹션에서 분리 — 의도를 가지고 스크롤해야만 도달.
 */
export function DangerZone({ onWithdrawClick }: Props) {
  return (
    <section className="pt-6 border-t border-[#2a1b12] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div>
        <p className="text-sm text-[#b4c4a4]">계정을 더 이상 사용하지 않으시나요?</p>
        <p className="text-xs text-[#6a5a44] mt-1">
          탈퇴하시면 계정 이용이 즉시 중단되고, 모든 동화책·주인공·목소리에 더 이상 접근할 수 없어요.
        </p>
      </div>
      <button
        type="button"
        onClick={onWithdrawClick}
        className="px-4 py-2 rounded-lg border border-[#e85c5c] text-[#e85c5c] text-sm font-medium hover:bg-[#e85c5c] hover:text-[#1a0f08] transition-colors shrink-0"
      >
        회원 탈퇴
      </button>
    </section>
  )
}
