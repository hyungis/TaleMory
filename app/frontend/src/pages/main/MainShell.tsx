import { Outlet } from 'react-router-dom'
import { MainPage } from './MainPage'

/**
 * `/` 와 `/main/*` 를 묶는 레이아웃 루트.
 *
 * MainPage 를 항상 렌더하고, 하위 라우트에 해당하는 오버레이만 `<Outlet />` 으로 갈아끼운다:
 * - `/`               → HomePage (랜딩 영상 / 나비 디졸브 오버레이)
 * - `/main`           → null (오버레이 없음, MainPage 만 노출)
 * - `/main/bookshelf` → null (MainPage 자체가 모달을 띄움)
 *
 * 이 패턴으로 `/` → `/main` 전환 시 MainPage 가 unmount/remount 되지 않아 ForestScene 의
 * particles / 애니메이션 / phase state 가 끊기지 않고 부드럽게 이어진다.
 *
 * (이전 구조에서는 HomePage 가 자체적으로 MainPage 를 in-place 렌더하다가 navigate 시점에
 *  unmount → 라우트 전환 후 새로 mount 되며 ForestScene 이 리셋되는 stutter 가 발생했음.)
 */
export function MainShell() {
  return (
    <>
      <MainPage />
      <Outlet />
    </>
  )
}
