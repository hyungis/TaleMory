import type { Story } from './types'

/**
 * 책장 더미 데이터 (디자인 검증용 — 20권).
 * 실제 API 연동되면 책 목록을 받아 fallback 으로만 동작.
 * 다양한 스타일/레벨/뱃지 조합으로 그리드 + 필터 + 정렬을 시각 테스트.
 */
export const DUMMY_STORIES: Story[] = [
  { id: 1,  title: '해솔이의 특별한 제주도 모험', date: '2026-04-08', style: '수채화 스타일',    pages: 12, level: '초급', badgeType: 'mic',   badgeText: '엄마아빠 목소리', bgClass: 'from-[#2d4a25] to-[#1a3014]' },
  { id: 2,  title: '두발 자전거를 탄 날',       date: '2026-03-15', style: '색연필 만화',       pages: 8,  level: '중급', badgeType: 'music', badgeText: 'BGM 포함',         bgClass: 'from-[#2a3a52] to-[#141e30]' },
  { id: 3,  title: '할머니 댁에서의 하루',      date: '2026-01-01', style: '라인 드로잉',       pages: 15, level: '고급', badgeType: 'mic',   badgeText: '엄마아빠 목소리', bgClass: 'from-[#5a2d2d] to-[#3a1515]' },
  { id: 4,  title: '우주 탐험대 출동',          date: '2026-04-10', style: '3D 렌더링',        pages: 20, level: '중급', badgeType: 'music', badgeText: '신나는 BGM',       bgClass: 'from-[#1f2a4a] to-[#0a1428]' },
  { id: 5,  title: '숲속 친구들의 파티',        date: '2025-12-25', style: '파스텔 톤',         pages: 10, level: '초급', badgeType: 'mic',   badgeText: '직접 녹음',         bgClass: 'from-[#4a5a28] to-[#2a3814]' },
  { id: 6,  title: '바닷속 인어 공주',          date: '2026-02-14', style: '수채화 스타일',    pages: 14, level: '고급', badgeType: 'music', badgeText: '바다 소리',        bgClass: 'from-[#1f3a44] to-[#0f2024]' },
  { id: 7,  title: '마법의 숲을 찾아서',        date: '2026-03-01', style: '동화책 일러스트', pages: 18, level: '중급', badgeType: 'mic',   badgeText: '엄마 목소리',      bgClass: 'from-[#2e3e28] to-[#182014]' },
  { id: 8,  title: '내 친구 공룡',              date: '2025-11-11', style: '크레파스 질감',    pages: 8,  level: '초급', badgeType: 'music', badgeText: '효과음 포함',      bgClass: 'from-[#4a3522] to-[#2a1d10]' },
  { id: 9,  title: '요리왕이 될 거야',          date: '2026-01-20', style: '라인 드로잉',       pages: 12, level: '고급', badgeType: 'mic',   badgeText: '아빠 목소리',      bgClass: 'from-[#5a3020] to-[#331810]' },
  { id: 10, title: '꿈나라 기차',               date: '2026-04-01', style: '수채화 스타일',    pages: 16, level: '초급', badgeType: 'music', badgeText: '자장가 BGM',       bgClass: 'from-[#3a1f3a] to-[#1e0f20]' },
  { id: 11, title: '장난감 병정의 모험',        date: '2025-10-05', style: '3D 렌더링',        pages: 22, level: '고급', badgeType: 'mic',   badgeText: '할머니 목소리',   bgClass: 'from-[#44332a] to-[#221810]' },
  { id: 12, title: '숨바꼭질 대장',             date: '2026-02-28', style: '색연필 만화',       pages: 10, level: '중급', badgeType: 'music', badgeText: '통통 튀는 BGM',    bgClass: 'from-[#2a4a4a] to-[#122424]' },
  { id: 13, title: '눈사람과 친구가 됐어요',    date: '2025-12-08', style: '수채화 스타일',    pages: 14, level: '초급', badgeType: 'music', badgeText: '겨울왕국 BGM',     bgClass: 'from-[#2a3850] to-[#0e1428]' },
  { id: 14, title: '강아지 또또의 첫 산책',     date: '2026-03-22', style: '동화책 일러스트', pages: 11, level: '초급', badgeType: 'mic',   badgeText: '아이 목소리',      bgClass: 'from-[#4a3a26] to-[#241a10]' },
  { id: 15, title: '비 오는 날의 우산 친구',    date: '2026-02-05', style: '파스텔 톤',         pages: 9,  level: '중급', badgeType: 'music', badgeText: '빗소리 ASMR',      bgClass: 'from-[#2a3e4a] to-[#101c24]' },
  { id: 16, title: '하늘을 나는 풍선 여행',     date: '2026-04-15', style: '수채화 스타일',    pages: 17, level: '고급', badgeType: 'mic',   badgeText: '온 가족 합창',     bgClass: 'from-[#5a3a4a] to-[#2a1828]' },
  { id: 17, title: '도서관에서 만난 마법사',    date: '2025-11-28', style: '라인 드로잉',       pages: 19, level: '고급', badgeType: 'music', badgeText: '신비로운 BGM',     bgClass: 'from-[#332a4a] to-[#181024]' },
  { id: 18, title: '꼬마 화가의 색깔 모험',     date: '2026-03-08', style: '크레파스 질감',    pages: 13, level: '초급', badgeType: 'mic',   badgeText: '아빠 목소리',      bgClass: 'from-[#5a4a2a] to-[#2e2410]' },
  { id: 19, title: '바람을 타고 떠난 여행',     date: '2026-01-30', style: '동화책 일러스트', pages: 16, level: '중급', badgeType: 'music', badgeText: '여행 BGM',         bgClass: 'from-[#2a4a3e] to-[#102420]' },
  { id: 20, title: '별을 따러 간 밤',           date: '2026-04-20', style: '3D 렌더링',        pages: 21, level: '고급', badgeType: 'mic',   badgeText: '엄마 자장가',      bgClass: 'from-[#1a1a3a] to-[#0a0a1c]' },
]
