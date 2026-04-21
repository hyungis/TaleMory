import { ForestScene } from './ui/ForestScene'
import './styles/main.css'

/**
 * 로그인 직후 진입하는 페이지.
 *
 * 현재는 ForestScene 단독 렌더. Task 2 에서 BookstoreScene 을 추가하고,
 * 집 클릭 시 forest ↔ bookstore 를 scene-container/bookstore-scene 컨테이너로 전환.
 */
export function MainPage() {
  return <ForestScene />
}
