import { Link } from 'react-router-dom'
import { ROUTES } from '../constants'

/**
 * 로그인 후 페이지의 공통 헤더.
 * 현재는 브랜드 로고 + 사용자 메뉴 placeholder.
 * TODO(S14P31S210-76): 사용자 정보(닉네임/아바타), 로그아웃, 알림 아이콘.
 */
export function Header() {
  return (
    <header className="h-14 px-6 bg-[#2a1b12] border-b border-[#4a3a24] flex items-center justify-between z-50">
      <Link
        to={ROUTES.home}
        className="text-[#3ca55c] text-xl font-bold tracking-wider"
        style={{
          textShadow: '0 0 12px rgba(60, 165, 92, 0.4), 0 2px 8px rgba(0, 0, 0, 0.6)',
        }}
      >
        TaleMory
      </Link>
      <div className="flex items-center gap-3 text-[#b4c4a4] text-sm">
        {/* TODO(S14P31S210-76): 사용자 메뉴 / 로그아웃 */}
      </div>
    </header>
  )
}
