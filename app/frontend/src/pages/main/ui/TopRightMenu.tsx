import { useEffect, useRef, useState } from 'react'
import { Menu, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { LogoutButton } from '../../../features/auth'
import { ROUTES } from '../../../shared/constants'

/** 마이페이지 진입 발화 지점 — 뒤로가기 시 어디로 돌아갈지 분기에 사용. */
export type MypageFrom = 'main' | 'bookshelf'

interface TopRightMenuProps {
  /**
   * `true` 면 메뉴가 자체적으로 우상단 absolute 위치를 잡는다 (ForestScene 처럼
   * 다른 우상단 컨테이너가 없는 경우). `false` (기본) 면 부모 flex 컨테이너 안에
   * 자연스럽게 배치된다 (BookstoreScene 의 `.bookstore-action-buttons` 안 등).
   */
  standalone?: boolean
  /**
   * 마이페이지 진입 시 location.state.from 에 기록할 발화 지점.
   * MypagePage 의 뒤로가기 동작이 이 값을 보고 main 또는 bookshelf 로 분기.
   * 미지정 시 'main' 으로 fallback.
   */
  mypageFrom?: MypageFrom
}

/**
 * 우상단 햄버거 메뉴 — 마이페이지 / 로그아웃 항목 노출.
 *
 * 외부 클릭 / ESC 로 닫힘. 메뉴 트리거의 `aria-expanded` 와 항목의 `role="menuitem"` 으로
 * 키보드/스크린리더 접근성 보장.
 *
 * ForestScene / BookstoreScene 양쪽에서 같은 모양으로 쓰기 위한 공통 컴포넌트.
 */
export function TopRightMenu({ standalone = false, mypageFrom = 'main' }: TopRightMenuProps) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // 외부 클릭 / ESC 로 닫기.
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  const wrapperClass = `top-right-menu${standalone ? ' top-right-menu--standalone' : ''}`

  return (
    <div className={wrapperClass} ref={menuRef}>
      <button
        type="button"
        className="top-right-menu__trigger"
        onClick={() => setIsOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="더보기 메뉴 열기"
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="top-right-menu__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="top-right-menu__item"
            onClick={() => {
              setIsOpen(false)
              // 발화 지점을 state.from 으로 기록 → MypagePage 의 뒤로가기에서 분기.
              navigate(ROUTES.mypage, { state: { from: mypageFrom } })
            }}
          >
            <User className="w-5 h-5" aria-hidden="true" />
            <span>마이페이지</span>
          </button>
          <LogoutButton />
        </div>
      )}
    </div>
  )
}
