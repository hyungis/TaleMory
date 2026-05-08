/**
 * 동화책 도메인 타입.
 * 현재는 책장 표시에 필요한 필드만 정의. 추후 백엔드 스펙 맞춰 확장 예정.
 */
import type { StoryId } from '../../shared/types'

export type StoryLevel = '초급' | '중급' | '고급'

export type StoryBadgeType = 'mic' | 'music'

export interface Story {
  id: StoryId
  title: string
  /** 표시용 ISO date string (YYYY-MM-DD). 정렬 정밀도는 createdAt 사용. */
  date: string
  /**
   * 작성 시작 시각 (BE `createdAt`). publishedAt 이 없을 때(즉 dummy 데이터/임시) 의 정렬 fallback.
   */
  createdAt?: string
  /**
   * 출판 완료 시각 (BE `publishedAt`). 책장 정렬의 1순위 키 — 책장은 published 만 보여주므로
   * 사용자가 "최신순" 으로 인지하는 기준은 "최근 출판한 동화" 다.
   */
  publishedAt?: string | null
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
