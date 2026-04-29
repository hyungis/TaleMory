import type { StoryLevel } from '../../../../entities/story'

/**
 * 난이도(level) 별 badge Tailwind 색상 클래스.
 *
 * Pastel Forest 디자인 시스템 v3 톤:
 *  - 초급: 파스텔 세이지 (sage)
 *  - 중급: 라이트 허니 (honey amber)
 *  - 고급: 딥 테라코타 (terracotta — pop accent)
 *
 * 표지 이미지 위에 얹히므로 다양한 배경에서 가독성 확보 위해 배경은 채도 적당,
 * 텍스트는 깊은 톤(#1F3318 / #3E2A18 / #F2EBD2) 으로 대비 확보.
 */
export function getLevelColor(level: StoryLevel): string {
  switch (level) {
    case '초급':
      return 'bg-[#8DBA64] text-[#1F3318]'
    case '중급':
      return 'bg-[#D9BE82] text-[#3E2A18]'
    case '고급':
      return 'bg-[#B0473F] text-[#F2EBD2]'
  }
}
