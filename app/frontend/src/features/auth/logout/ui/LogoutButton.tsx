import { useCallback } from 'react'
import { LogOut } from 'lucide-react'
import { useLogout } from '../model/useLogout'

export function LogoutButton() {
  const { isPending, logout } = useLogout()

  const handleClick = useCallback(() => {
    void logout().catch(() => {
      window.alert('로그아웃에 실패했습니다. 잠시 후 다시 시도해주세요.')
    })
  }, [logout])

  return (
    <button
      type="button"
      className="bookstore-action-btn logout-btn"
      onClick={handleClick}
      disabled={isPending}
    >
      <LogOut className="w-5 h-5" aria-hidden />
      <span>{isPending ? '로그아웃 중...' : '로그아웃'}</span>
    </button>
  )
}
