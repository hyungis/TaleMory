import { LogOut } from 'lucide-react'

interface Props {
  onWithdrawClick: () => void
  onLogoutClick: () => void
  isLoggingOut?: boolean
}

/**
 * 페이지 최하단 위험 영역 — paper-craft 톤.
 * 회원 탈퇴 + 로그아웃 두 액션을 묶어 노출. 오발 방지를 위해 프로필 섹션에서 분리 —
 * 의도를 가지고 스크롤해야만 도달.
 */
export function DangerZone({ onWithdrawClick, onLogoutClick, isLoggingOut = false }: Props) {
  return (
    <section className="mp-danger-zone">
      <div className="mp-dz-text">
        <strong>계정을 더 이상 사용하지 않으시나요?</strong>
        <span className="mp-small">
          탈퇴하시면 계정 이용이 즉시 중단되지만, 마음이 바뀌실 경우{' '}
          <span className="mp-emph">3개월 안</span>에 다시 로그인하시면 계정과 모든 동화책·주인공·목소리를 복구할 수 있어요.
        </span>
      </div>

      {/* 회원 탈퇴 + 로그아웃 side-by-side. */}
      <div className="mp-dz-actions">
        <button type="button" onClick={onWithdrawClick} className="mp-btn mp-btn-rust">
          ⚠ 회원 탈퇴
        </button>
        <button
          type="button"
          onClick={onLogoutClick}
          disabled={isLoggingOut}
          className="mp-btn mp-btn-ghost"
        >
          <LogOut className="w-4 h-4" />
          {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </div>
    </section>
  )
}
