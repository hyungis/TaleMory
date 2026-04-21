import { useMemo } from 'react'
import type { Story } from '../../../../entities/story'
import { useItemsPerRow } from '../model/useItemsPerRow'
import { BookshelfRow } from './BookshelfRow'

interface StoryGridProps {
  stories: Story[]
  onRead?: (story: Story) => void
  onShare?: (story: Story) => void
  onDelete?: (story: Story) => void
}

const GRID_COLS_BY_COUNT: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
}

/**
 * 전체 책 목록을 N 권씩 chunk 해서 각 "선반(BookshelfRow)" 으로 렌더.
 * itemsPerRow 는 윈도우 너비 기반(useItemsPerRow) — 1/2/3/4 열 반응형.
 */
export function StoryGrid({ stories, onRead, onShare, onDelete }: StoryGridProps) {
  const itemsPerRow = useItemsPerRow()
  const gridColsClass = GRID_COLS_BY_COUNT[itemsPerRow] ?? 'grid-cols-4'

  const rows = useMemo(() => {
    const result: Story[][] = []
    for (let i = 0; i < stories.length; i += itemsPerRow) {
      result.push(stories.slice(i, i + itemsPerRow))
    }
    return result
  }, [stories, itemsPerRow])

  return (
    <div className="w-full flex flex-col gap-[90px] pt-4 pb-16">
      {rows.map((rowBooks, rowIdx) => (
        <BookshelfRow
          key={rowIdx}
          books={rowBooks}
          rowIdx={rowIdx}
          itemsPerRow={itemsPerRow}
          gridColsClass={gridColsClass}
          onRead={onRead}
          onShare={onShare}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
