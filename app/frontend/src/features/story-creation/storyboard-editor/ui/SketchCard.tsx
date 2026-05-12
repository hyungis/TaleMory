import type { StoryboardPageDraft } from '../../model/types'
import { getPageIcon } from '../../../../shared/lib'
import { IllustrationMockup } from '../../../../shared/ui'

interface SketchCardProps {
  page: StoryboardPageDraft
  size?: 'sm' | 'lg'
}

/**
 * 스토리보드 페이지의 "스케치 카드" 공용 시각 요소.
 * Grid 썸네일 + Single 좌측 + Preview modal 에서 재사용.
 *
 * 실제 AI 일러스트가 아직 생성되기 전의 목업:
 *  - 배경에 은은한 풍경 SVG (산/언덕/나무 실루엣)
 *  - 중앙에 페이지 아이콘(lucide) + 스케치 설명 텍스트
 */
export function SketchCard({ page, size = 'sm' }: SketchCardProps) {
  const Icon = getPageIcon(page.icon)
  const isLarge = size === 'lg'

  return (
    <div
      className={`relative ${isLarge ? 'p-6' : 'p-4'} rounded-2xl text-center overflow-hidden bg-gradient-to-b from-[#fff9dd] to-[#f0e6c0] border ${isLarge ? 'border-[#8b7a52]/40 shadow-lg' : 'border-[#8b7a52]/30 shadow-md'}`}
      style={{ maxWidth: isLarge ? '85%' : '90%' }}
    >
      {/* 배경 풍경 목업 */}
      <IllustrationMockup
        variant="scenery"
        className="absolute inset-0 w-full h-full text-[#2d5a27]"
      />
      {/* 텍스처 오버레이 (종이 질감 느낌) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 20%, rgba(139, 122, 82, 0.18), transparent 55%), radial-gradient(circle at 70% 80%, rgba(45, 90, 39, 0.15), transparent 60%)',
        }}
      />

      {/* 메인 아이콘 + 텍스트 */}
      <div className="relative z-10 flex flex-col items-center">
        <Icon
          className={`${isLarge ? 'w-16 h-16' : 'w-12 h-12'} text-[#2d5a27] ${isLarge ? 'mb-3' : 'mb-2'}`}
          strokeWidth={2.2}
          style={{ filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.18))' }}
        />
        <p
          className={`text-[#2d5a27] font-sans font-bold ${isLarge ? 'text-xl' : 'text-base'} leading-relaxed`}
        >
          {page.sketch}
        </p>
      </div>
    </div>
  )
}
