import { ROUTES } from '../../../shared/constants'

export interface OnboardingStep {
  id: string
  route: string
  previewStep?: number
  viewerPreviewMode?: 'main' | 'book' | 'tools'
  selector: string
  title: string
  description: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'main-house',
    route: ROUTES.main,
    selector: '[data-onboarding-target="main-house"]',
    title: '우리 가족 책장으로 들어가기',
    description: '메인 화면에서는 집 문을 통해 우리 가족의 동화책 책장으로 들어갈 수 있어요.',
  },
  {
    id: 'bookshelf-list',
    route: ROUTES.mainBookshelf,
    selector: '[data-onboarding-target="bookshelf-list"]',
    title: '동화책 목록',
    description: '여기에서 완성한 동화책을 읽고, 공유하고, 관리할 수 있어요.',
  },
  {
    id: 'bookshelf-create',
    route: ROUTES.mainBookshelf,
    selector: '[data-onboarding-target="bookshelf-create"]',
    title: '새 동화책 만들기',
    description: '새로운 여행 이야기를 만들고 싶을 때 사용하는 시작 버튼이에요.',
  },
  {
    id: 'creation-step-1',
    route: ROUTES.creation,
    previewStep: 1,
    selector: '[data-onboarding-target="creation-step-1-content"]',
    title: '1단계 기본 정보',
    description: '주인공, 함께한 사람, 여행 일정과 장소를 입력하는 영역이에요. 실제 입력 없이 설명만 보고 넘어갑니다.',
  },
  {
    id: 'creation-step-2',
    route: ROUTES.creation,
    previewStep: 2,
    selector: '[data-onboarding-target="creation-step-2-content"]',
    title: '2단계 사진 업로드',
    description: '추억 사진과 대표 사진을 올려서 AI가 가족과 여행 분위기를 참고할 수 있게 하는 단계예요.',
  },
  {
    id: 'creation-step-3',
    route: ROUTES.creation,
    previewStep: 3,
    selector: '[data-onboarding-target="creation-step-3-content"]',
    title: '3단계 줄거리 확인',
    description: '입력한 정보와 사진을 바탕으로 만들어진 줄거리를 확인하고 다듬는 단계예요.',
  },
  {
    id: 'creation-step-4',
    route: ROUTES.creation,
    previewStep: 4,
    selector: '[data-onboarding-target="creation-step-4-content"]',
    title: '4단계 스토리보드 편집',
    description: '페이지별 글, 번역, 그림을 확인하고 필요한 부분을 수정하는 단계예요.',
  },
  {
    id: 'creation-step-5',
    route: ROUTES.creation,
    previewStep: 5,
    selector: '[data-onboarding-target="creation-step-5-content"]',
    title: '5단계 그림 스타일',
    description: '동화책에 어울리는 그림체를 선택하는 단계예요. 선택 후에는 스타일이 고정됩니다.',
  },
  {
    id: 'creation-step-6',
    route: ROUTES.creation,
    previewStep: 6,
    selector: '[data-onboarding-target="creation-step-6-content"]',
    title: '6단계 목소리 준비',
    description: '동화 읽어주기에 사용할 목소리를 녹음하거나 기존 목소리를 불러오는 단계예요.',
  },
  {
    id: 'creation-step-7',
    route: ROUTES.creation,
    previewStep: 7,
    selector: '[data-onboarding-target="creation-step-7-content"]',
    title: '7단계 하이라이트와 맺음말',
    description: '강조해서 읽을 문장과 마지막 맺음말을 정리하는 단계예요.',
  },
  {
    id: 'creation-step-8',
    route: ROUTES.creation,
    previewStep: 8,
    selector: '[data-onboarding-target="creation-step-8-content"]',
    title: '8단계 최종 미리보기',
    description: '완성된 동화책을 발행하기 전에 전체 흐름을 확인하는 단계예요.',
  },
  {
    id: 'creation-step-9',
    route: ROUTES.creation,
    previewStep: 9,
    selector: '[data-onboarding-target="creation-step-9-content"]',
    title: '9단계 동화 발행',
    description: '완성한 동화책을 책장에 저장하고 가족에게 공유할 수 있게 발행하는 단계예요.',
  },
  {
    id: 'viewer-main',
    route: ROUTES.onboardingViewerPreview,
    viewerPreviewMode: 'main',
    selector: '[data-onboarding-target="viewer-main"]',
    title: '동화책 뷰어 시작',
    description: '완성된 동화를 열면 먼저 표지와 기본 정보를 보고, 어떤 방식으로 읽을지 고를 수 있어요.',
  },
  {
    id: 'viewer-open-book',
    route: ROUTES.onboardingViewerPreview,
    viewerPreviewMode: 'main',
    selector: '[data-onboarding-target="viewer-open-book"]',
    title: '동화책 모드 열기',
    description: '동화책 모드를 누르면 책장을 넘기며 읽는 메인 뷰어로 들어갑니다. 튜토리얼에서는 설명만 보고 다음으로 넘어가면 돼요.',
  },
  {
    id: 'viewer-book',
    route: ROUTES.onboardingViewerPreview,
    viewerPreviewMode: 'book',
    selector: '[data-onboarding-target="viewer-book"]',
    title: '메인 동화책 뷰어',
    description: '여기서 그림과 문장을 읽고, 양쪽 화살표로 앞뒤 페이지를 넘길 수 있어요. 문장을 누르면 해당 문장 음성도 들을 수 있어요.',
  },
  {
    id: 'viewer-tools',
    route: ROUTES.onboardingViewerPreview,
    viewerPreviewMode: 'tools',
    selector: '[data-onboarding-target="viewer-tools"]',
    title: '읽기 도구 패널',
    description: '왼쪽 도구에서 전체 음성 읽기, 일시정지, 번역 보기, 글자 크기 조절, 책갈피 저장과 이동을 사용할 수 있어요.',
  },
]
