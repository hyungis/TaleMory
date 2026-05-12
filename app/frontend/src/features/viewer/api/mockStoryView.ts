import type { StoryView } from '../model/types'

/**
 * 뷰어 UI 개발용 Mock 데이터.
 * 로그인 + 실제 동화 생성 플로우 완성 후 BE 응답으로 교체.
 *
 * 구조:
 *  - `coverIllustrationUrl` 와 `scenes[0]` (pageNumber=0) 가 같은 이미지를 가리키도록 — BE 의
 *    `StoryViewerService` 가 `coverIllustrationUrl = scenes.firstOrNull()?.illustrationUrl` 로
 *    내려주는 형태와 동일하게 유지. 뷰어는 표지 일러스트는 `coverIllustrationUrl` 로만 그리고,
 *    scene 0 는 본문 rotation 에서 제외 (FE 가 slice(1) 로 컷팅) 한다.
 *  - picsum.photos seed 기반 URL — 같은 seed 면 매번 같은 그림이 와서 디자인 검증 안정적.
 */

const COVER_URL = 'https://picsum.photos/seed/talemory-cover-haesol/960/720'
const PAGE_URLS = [
  'https://picsum.photos/seed/talemory-page1-airport/960/720',
  'https://picsum.photos/seed/talemory-page2-window/960/720',
  'https://picsum.photos/seed/talemory-page3-captain/960/720',
  'https://picsum.photos/seed/talemory-page4-sunset/960/720',
]

export const MOCK_STORY_VIEW: StoryView = {
  storyId: '1',
  title: '해솔이의 첫 비행 이야기',
  difficulty: 'INTERMEDIATE',
  mainCharacter: { name: '해솔' },
  coverIllustrationUrl: COVER_URL,
  publishedAt: '2026-04-20T12:00:00',

  scenes: [
    // 표지 (page 0) — 본문 rotation 에서 제외되지만 BE 응답 형태와 맞추려 포함.
    {
      sceneId: '100',
      pageNumber: 0,
      illustrationUrl: COVER_URL,
      characterAnchors: [],
      sentences: [],
    },
    // 본문 page 1
    {
      sceneId: '101',
      pageNumber: 1,
      illustrationUrl: PAGE_URLS[0],
      characterAnchors: [],
      sentences: [
        {
          sentenceId: '1001',
          sentenceOrder: 1,
          englishText: 'Haesol arrived at the airport with sparkling eyes.',
          koreanText: '해솔이는 반짝이는 눈으로 공항에 도착했어요.',
          ttsAudioUrl: null,
          speakerKey: 'narration',
          bubbleSlot: null,
        },
        {
          sentenceId: '1002',
          sentenceOrder: 2,
          englishText: 'He had never seen such a big airplane before.',
          koreanText: '그렇게 큰 비행기를 본 것은 처음이었죠.',
          ttsAudioUrl: null,
          speakerKey: 'narration',
          bubbleSlot: null,
        },
        {
          sentenceId: '1003',
          sentenceOrder: 3,
          englishText: 'His heart bounced like a little drum.',
          koreanText: '해솔이의 심장은 작은 북처럼 두근거렸어요.',
          ttsAudioUrl: null,
          speakerKey: 'thought',
          bubbleSlot: null,
        },
      ],
    },
    // 본문 page 2
    {
      sceneId: '102',
      pageNumber: 2,
      illustrationUrl: PAGE_URLS[1],
      characterAnchors: [],
      sentences: [
        {
          sentenceId: '1004',
          sentenceOrder: 1,
          englishText: 'Soon, Haesol found a window seat and pressed his nose to the glass.',
          koreanText: '곧 해솔이는 창가 자리를 찾아 유리창에 코를 바짝 댔어요.',
          ttsAudioUrl: null,
          speakerKey: 'narration',
          bubbleSlot: null,
        },
        {
          sentenceId: '1005',
          sentenceOrder: 2,
          englishText: 'Outside, the clouds looked like giant scoops of vanilla ice cream.',
          koreanText: '밖의 구름은 거대한 바닐라 아이스크림 한 스쿱처럼 보였어요.',
          ttsAudioUrl: null,
          speakerKey: 'narration',
          bubbleSlot: null,
        },
        {
          sentenceId: '1006',
          sentenceOrder: 3,
          englishText: 'The sky is a secret playground!',
          koreanText: '하늘은 비밀 놀이터 같아!',
          ttsAudioUrl: null,
          speakerKey: '해솔',
          bubbleSlot: { x: 0.5, y: 0.5 },
        },
      ],
    },
    // 본문 page 3
    {
      sceneId: '103',
      pageNumber: 3,
      illustrationUrl: PAGE_URLS[2],
      characterAnchors: [],
      sentences: [
        {
          sentenceId: '1007',
          sentenceOrder: 1,
          englishText: 'Welcome aboard, everyone!',
          koreanText: '여러분, 환영합니다!',
          ttsAudioUrl: null,
          speakerKey: '기장님',
          bubbleSlot: { x: 0.5, y: 0.05 },
        },
        {
          sentenceId: '1008',
          sentenceOrder: 2,
          englishText: 'Haesol sat up straight and listened to every single word.',
          koreanText: '해솔이는 허리를 곧게 펴고 한 마디도 놓치지 않으려 했죠.',
          ttsAudioUrl: null,
          speakerKey: 'narration',
          bubbleSlot: null,
        },
        {
          sentenceId: '1009',
          sentenceOrder: 3,
          englishText: 'The flight suddenly felt less scary and much more exciting.',
          koreanText: '비행은 갑자기 덜 무섭고 훨씬 더 신나게 느껴졌어요.',
          ttsAudioUrl: null,
          speakerKey: 'narration',
          bubbleSlot: null,
        },
      ],
    },
    // 본문 page 4
    {
      sceneId: '104',
      pageNumber: 4,
      illustrationUrl: PAGE_URLS[3],
      characterAnchors: [],
      sentences: [
        {
          sentenceId: '1010',
          sentenceOrder: 1,
          englishText: 'As the plane crossed the sunset, Haesol made a tiny promise to himself.',
          koreanText: '비행기가 노을을 가로지르자 해솔이는 작은 약속을 했어요.',
          ttsAudioUrl: null,
          speakerKey: 'narration',
          bubbleSlot: null,
        },
        {
          sentenceId: '1011',
          sentenceOrder: 2,
          englishText: 'I will keep collecting brave moments, wherever I go.',
          koreanText: '어디를 가든 용감한 순간들을 계속 모으기로 한 거예요.',
          ttsAudioUrl: null,
          speakerKey: 'thought',
          bubbleSlot: null,
        },
        {
          sentenceId: '1012',
          sentenceOrder: 3,
          englishText: 'The sky felt wide enough to hold all his dreams.',
          koreanText: '하늘은 그의 모든 꿈을 담아낼 만큼 넓게 느껴졌답니다.',
          ttsAudioUrl: null,
          speakerKey: 'narration',
          bubbleSlot: null,
        },
      ],
    },
  ],

  outro: {
    outroText: '해솔아, 오늘도 씩씩했어.\n세상엔 무서운 것보다\n신나는 게 훨씬 많단다.\n\n잘 자, 내 작은 용감이.\n사랑해 💕',
    audioUrl: null,
    signature: '— 엄마가',
  },
}
