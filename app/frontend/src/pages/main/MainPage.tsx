import { useLocation } from 'react-router-dom'
import { ForestScene } from './ui/ForestScene'
import { BookstoreScene } from './ui/BookstoreScene'
import { useSceneTransition, type Scene } from './model/useSceneTransition'
import './styles/main.css'

/**
 * 로그인 직후 진입하는 페이지. 숲 씬과 서점 씬을 내부에서 opacity crossfade 로 전환.
 *
 * 구조:
 *   .scene-container  (forest) — .active/.inactive 로 opacity 토글
 *   .bookstore-scene  (bookstore) — 동일
 *
 * 전환 트리거:
 *   - ForestScene 의 집 클릭 → 아이 걷기 → 문 앞 도착 → onEnterBookstore()
 *   - BookstoreScene 의 ← 버튼 → backToForest()
 *
 * 초기 씬은 기본 'forest'. 다른 라우트(예: CreationPage 의 "내 책장 보관하기")에서
 * `navigate('/main', { state: { scene: 'bookstore' } })` 로 진입하면 숲 재생 없이 바로 책장을 연다.
 */
export function MainPage() {
  const location = useLocation()
  const initialScene: Scene =
    (location.state as { scene?: Scene } | null)?.scene === 'bookstore' ? 'bookstore' : 'forest'
  const { currentScene, enterBookstore, backToForest } = useSceneTransition(initialScene)

  return (
    <>
      <div className={`scene-container ${currentScene === 'forest' ? 'active' : 'inactive'}`}>
        <ForestScene onEnterBookstore={enterBookstore} />
      </div>

      <div className={`bookstore-scene ${currentScene === 'bookstore' ? 'active' : 'inactive'}`}>
        <BookstoreScene onBackToForest={backToForest} />
      </div>
    </>
  )
}
