import type { StoryLevel } from '../../../../entities/story'

/** 난이도(level) 별 badge Tailwind 색상 클래스. */
export function getLevelColor(level: StoryLevel): string {
  switch (level) {
    case '초급':
      return 'bg-[#b4dc8c] text-[#1a3a14]'
    case '중급':
      return 'bg-[#d4b86a] text-[#4a3a14]'
    case '고급':
      return 'bg-[#c97b4a] text-[#f0e6c0]'
  }
}
