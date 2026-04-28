/**
 * 동화책 도메인 타입.
 * 현재는 책장 표시에 필요한 필드만 정의. 추후 백엔드 스펙 맞춰 확장 예정.
 */

export type StoryLevel = '초급' | '중급' | '고급'

export type StoryBadgeType = 'mic' | 'music'

export interface Story {
  id: number
  title: string
  /** 표시용 ISO date string (YYYY-MM-DD). 정렬 정밀도는 createdAt 사용. */
  date: string
  /**
   * 정렬 기준. BE 의 `createdAt` 원본 datetime ISO (예: "2026-04-27T10:23:11Z").
   * 같은 날 만든 책 사이 시간 차이까지 정확히 정렬하기 위해 별도로 보관.
   * dummy 데이터에선 미설정 가능 → date 로 fallback.
   */
  createdAt?: string
  /** 삽화 스타일 라벨 (원본 더미 데이터 기준) */
  style: string
  /** 페이지 수 */
  pages: number
  level: StoryLevel
  badgeType: StoryBadgeType
  badgeText: string
  /**
   * 표지 gradient 배경 Tailwind 클래스 (예: 'from-[#2d4a25] to-[#1a3014]').
   * 추후 백엔드에서 표지 이미지 URL 내려오면 coverUrl 로 교체.
   */
  bgClass: string
  /** 백엔드 원본 필드 (API 연동 시 사용) */
  status?: string
  shareToken?: string | null
  coverImageUrl?: string | null
}
