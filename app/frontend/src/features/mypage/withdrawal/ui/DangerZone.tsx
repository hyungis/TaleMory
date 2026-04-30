import { LogOut } from 'lucide-react'

interface Props {
  onWithdrawClick: () => void
  onLogoutClick: () => void
  isLoggingOut?: boolean
}

/**
 * 페이지 최하단 위험 영역 — Pastel Forest 톤의 dusty rose 강조.
 * 회원 탈퇴 + 로그아웃 두 액션을 묶어 노출. 오발 방지를 위해 프로필 섹션에서 분리 —
 * 의도를 가지고 스크롤해야만 도달.
 */
export function DangerZone({ onWithdrawClick, onLogoutClick, isLoggingOut = false }: Props) {
  return (
    <section className="pt-6 mt-2 border-t border-[#9A7548]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <p className="text-sm text-[#3E2A18] font-bold">계정을 더 이상 사용하지 않으시나요?</p>
        <p className="text-xs text-[#9A7548] mt-1 leading-relaxed">
          탈퇴하시면 계정 이용이 즉시 중단되지만, 마음이 바뀌실 경우{' '}
          <span className="text-[#3F6B2E] font-bold">3개월 안</span> 에 다시 로그인하시면 계정과 모든 동화책·주인공·목소리를 복구할 수 있어요.
        </p>
      </div>

      {/* 우측 액션 묶음 — 회원 탈퇴 + 로그아웃 side-by-side. 회원 탈퇴가 더 무거운 액션이라 좌측에 두고
          오른쪽 끝에 로그아웃이 오도록 배치. */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onWithdrawClick}
          className="px-5 py-2.5 rounded-full border-2 border-[#D8857C] text-[#a3413f] text-sm font-bold bg-[#F4E4BC] hover:bg-[#D8857C] hover:text-[#FFFEF8] transition-colors"
        >
          회원 탈퇴
        </button>
        <button
          type="button"
          onClick={onLogoutClick}
          disabled={isLoggingOut}
          className="px-5 py-2.5 rounded-full border-2 border-[#9A7548]/40 text-[#3E2A18] text-sm font-bold bg-[#E9DBBE] hover:bg-[#D9BE82] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className="w-4 h-4" />
          {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </div>
    </section>
  )
}
