import type { StoryboardPageDraft } from '../../model/types'

/** AI refine 전체 한도 (원본 App.jsx MAX_GLOBAL_REFINE). */
export const MAX_GLOBAL_REFINE = 10
/** 페이지당 AI refine 개별 한도 (원본 MAX_PER_PAGE_REFINE). */
export const MAX_PER_PAGE_REFINE = 2

/** 기본 스토리 본문 (AI 생성 가정). 실제 API 연동 전까지 fallback. */
export const DEFAULT_STORY_TEXT =
  '해솔이의 첫 여름 휴가 이야기예요. 처음 타보는 비행기에 설레며 공항에 도착한 해솔이는, 푸른 바다와 하얀 모래사장이 펼쳐진 아름다운 섬에서 잊지 못할 하루하루를 보냅니다.'

/** 기본 스토리보드 10페이지. 실제로는 AI 가 생성해서 채움. */
export const DEFAULT_STORYBOARD_PAGES: StoryboardPageDraft[] = [
  { icon: 'plane-takeoff', sketch: '공항 도착', en: 'Haesol arrived at the huge airport.', ko: '해솔이가 거대한 공항에 도착했어요.' },
  { icon: 'waves',         sketch: '해변 도착', en: 'Finally, they arrived at the beautiful beach.', ko: '드디어 아름다운 해변에 도착했어요.' },
  { icon: 'ice-cream',     sketch: '아이스크림', en: 'On the white sandy beach, Haesol ate a big ice cream.', ko: '하얀 모래사장에서 해솔이는 커다란 아이스크림을 먹었어요.' },
  { icon: 'shell',         sketch: '조개껍데기', en: 'Haesol found many pretty seashells on the sand.', ko: '해솔이는 모래 위에서 예쁜 조개껍데기를 잔뜩 발견했어요.' },
  { icon: 'sun',           sketch: '노을',     en: 'As the sun set, the sky turned orange and pink.', ko: '해가 지면서 하늘은 주황색과 분홍색으로 물들었어요.' },
  { icon: 'tent',          sketch: '텐트 밤',   en: 'At night, they stayed in a cozy tent by the beach.', ko: '밤이 되자 가족은 해변가 아늑한 텐트에서 머물렀어요.' },
  { icon: 'fish',          sketch: '스노클링',  en: 'The next day, Haesol went snorkeling.', ko: '다음 날 해솔이는 스노클링을 했어요.' },
  { icon: 'palmtree',      sketch: '야자수 해먹', en: 'Under a tall palm tree, Haesol rested in a swinging hammock.', ko: '키 큰 야자수 아래에서 해솔이는 흔들리는 해먹에 누워 쉬었어요.' },
  { icon: 'cake',          sketch: '생일 파티',   en: 'That evening, the family had a surprise birthday party for Haesol!', ko: '그날 저녁, 가족은 해솔이를 위해 깜짝 생일파티를 열었어요!' },
  { icon: 'heart',         sketch: '집으로',     en: 'It was time to go home. Haesol waved goodbye from the plane.', ko: '이제 집으로 돌아갈 시간이에요. 해솔이는 비행기 안에서 손을 흔들었어요.' },
]

export const REFINE_QUICK_TAGS = [
  { emoji: '✨', text: '더 감동적으로' },
  { emoji: '👶', text: '아이의 시점으로' },
  { emoji: '😄', text: '유머러스하게' },
  { emoji: '📝', text: '짧고 간결하게' },
] as const
