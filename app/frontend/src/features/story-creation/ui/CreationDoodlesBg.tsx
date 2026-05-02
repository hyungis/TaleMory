import { BookshelfDoodles } from '../../bookshelf'

/**
 * 동화 만들기 모든 단계의 손그림 doodle 배경.
 * `.cr-doodles-bg` 로 viewport 고정, z-index: 0 (컨텐츠보다 뒤).
 * 책장/마이페이지와 동일한 BookshelfDoodles 재사용.
 */
export function CreationDoodlesBg() {
  return (
    <div className="cr-doodles-bg" aria-hidden="true">
      <BookshelfDoodles />
    </div>
  )
}
