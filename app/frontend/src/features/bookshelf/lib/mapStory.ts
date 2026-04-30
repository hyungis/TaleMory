import type { Story, StoryLevel } from '../../../entities/story'
import type { StoryApiResponse } from '../api'

const DIFFICULTY_MAP: Record<string, StoryLevel> = {
  BEGINNER: '초급',
  INTERMEDIATE: '중급',
  ADVANCED: '고급',
}

const BG_CLASSES = [
  'from-[#2d4a25] to-[#1a3014]',
  'from-[#4a3728] to-[#2d1f16]',
  'from-[#28384a] to-[#162030]',
  'from-[#4a2844] to-[#2d162a]',
  'from-[#3a4a28] to-[#222d16]',
  'from-[#4a4028] to-[#2d2616]',
]

/** 백엔드 StoryResponse → 프론트 표시용 Story 변환 */
export function mapApiToStory(api: StoryApiResponse): Story {
  return {
    id: api.id,
    title: api.title ?? '제목 없는 동화',
    date: api.createdAt.split('T')[0],
    // 정렬용 — 시간 정밀도까지 보존된 datetime ISO 원본.
    createdAt: api.createdAt,
    style: '동화',
    pages: api.sceneCount,
    level: DIFFICULTY_MAP[api.difficulty] ?? '초급',
    badgeType: 'mic',
    badgeText: 'AI 음성',
    bgClass: BG_CLASSES[api.id % BG_CLASSES.length],
    publishedAt: api.publishedAt,
    status: api.status,
    shareToken: api.shareToken,
    coverImageUrl: api.coverImageUrl,
  }
}
