import type { StoryLevel } from '../../../../entities/story'

/**
 * 난이도(level) 별 badge Tailwind 색상 클래스.
 *
 * 책장 배경(다크 브라운 + amber 햇살 + 이끼 wash)과 어울리도록 톤다운된 자연 톤:
 *  - 초급: sage moss green (이끼 톤)
 *  - 중급: warm honey amber
 *  - 고급: deep terracotta
 */
export function getLevelColor(level: StoryLevel): string {
  switch (level) {
    case '초급':
      return 'bg-[#8fb56a] text-[#1a2e10]'
    case '중급':
      return 'bg-[#c9a85a] text-[#3a2a14]'
    case '고급':
      return 'bg-[#b5683c] text-[#f0e6c0]'
  }
}
