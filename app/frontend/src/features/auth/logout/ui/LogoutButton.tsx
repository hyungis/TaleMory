import { useCallback, useState } from 'react'
import { LogOut } from 'lucide-react'
import { FeedbackDialog } from '../../../../shared/ui'
import { useLogout } from '../model/useLogout'

export function LogoutButton() {
  const { isPending, logout, finishLogout } = useLogout()
  const [dialog, setDialog] = useState<'success' | 'error' | null>(null)

  const handleClick = useCallback(() => {
    void logout()
      .then(() => setDialog('success'))
      .catch(() => setDialog('error'))
  }, [logout])

  return (
    <>
      <button
        type="button"
        className="bookstore-action-btn logout-btn"
        onClick={handleClick}
        disabled={isPending}
      >
        <LogOut className="w-5 h-5" aria-hidden />
        <span>{isPending ? '로그아웃 중...' : '로그아웃'}</span>
      </button>
      {dialog === 'success' && (
        <FeedbackDialog
          variant="success"
          title="로그아웃 완료"
          message="로그아웃되었습니다."
          onClose={finishLogout}
        />
      )}
      {dialog === 'error' && (
        <FeedbackDialog
          variant="error"
          title="로그아웃 실패"
          message="로그아웃에 실패했습니다. 잠시 후 다시 시도해주세요."
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
