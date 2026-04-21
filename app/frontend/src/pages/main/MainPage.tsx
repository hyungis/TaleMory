import { ForestScene } from './ui/ForestScene'
import { BookstoreScene } from './ui/BookstoreScene'
import { useSceneTransition } from './model/useSceneTransition'
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
 */
export function MainPage() {
  const { currentScene, enterBookstore, backToForest } = useSceneTransition()

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
