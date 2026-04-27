import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../shared/constants'
import { ForestScene } from './ui/ForestScene'
import { BookstoreScene } from './ui/BookstoreScene'
import './styles/main.css'

/**
 * 인증 후 진입하는 메인 페이지 (`/main`).
 *
 * 라우팅 구조:
 *   /main             → ForestScene (house.png) 만 표시
 *   /main/bookshelf   → ForestScene + 그 위에 BookshelfModal (BookstoreScene 호스트)
 *
 * AppRouter 가 `/main/*` 와일드카드로 두 경로를 모두 매칭하므로 URL 이 바뀌어도
 * MainPage 자체는 mount 유지된다 → ForestScene 의 파티클/애니메이션 리셋 없음.
 *
 * 새로고침 시: `/main/bookshelf` 라면 그대로 BookshelfModal 이 열린 상태로 시작.
 * 즉 책장 화면도 URL 로 표현되어 새로고침/직접 링크가 가능하다.
 */
export function MainPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const isBookshelfOpen = location.pathname === ROUTES.mainBookshelf

  /** 집 문 클릭 → ForestScene zoom 종료 직전 호출되어 책장 라우트로 이동. */
  const handleEnterBookshelf = useCallback(() => {
    navigate(ROUTES.mainBookshelf)
  }, [navigate])

  /** 책장 모달 닫기 / 외부 클릭 시 forest 라우트로 복귀. */
  const handleCloseBookshelf = useCallback(() => {
    navigate(ROUTES.main)
  }, [navigate])

  return (
    <>
      <ForestScene onEnterBookstore={handleEnterBookshelf} />
      {isBookshelfOpen && (
        <BookstoreScene isActive onBackToForest={handleCloseBookshelf} />
      )}
    </>
  )
}
