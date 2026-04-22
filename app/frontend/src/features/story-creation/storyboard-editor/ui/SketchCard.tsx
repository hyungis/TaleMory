import type { StoryboardPageDraft } from '../../model/types'
import { getPageIcon } from '../lib/pageIcons'

interface SketchCardProps {
  page: StoryboardPageDraft
  size?: 'sm' | 'lg'
}

/**
 * 스토리보드 페이지의 "스케치 카드" 공용 시각 요소.
 * Grid view 썸네일 + Single view 좌측 + Preview modal 에서 재사용.
 */
export function SketchCard({ page, size = 'sm' }: SketchCardProps) {
  const Icon = getPageIcon(page.icon)
  const isLarge = size === 'lg'
  return (
    <div
      className={`bg-[#f0e6c0]/95 ${isLarge ? 'p-6' : 'p-4'} rounded-2xl text-center shadow-${isLarge ? 'lg' : 'md'} border border-[#8b7a52]/${isLarge ? '40' : '30'} max-w-[${isLarge ? '85%' : '90%'}]`}
    >
      <Icon
        className={`${isLarge ? 'w-16 h-16' : 'w-12 h-12'} mx-auto text-[#2d5a27] ${isLarge ? 'mb-3' : 'mb-2'} opacity-90`}
      />
      <p
        className={`text-[#2d5a27] font-sans font-bold ${isLarge ? 'text-lg' : 'text-sm'} leading-relaxed`}
      >
        {page.sketch}
      </p>
    </div>
  )
}
