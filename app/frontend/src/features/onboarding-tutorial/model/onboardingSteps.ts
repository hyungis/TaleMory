import { ROUTES } from '../../../shared/constants'

export interface OnboardingStep {
  id: string
  route: string
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
    description: '집 문을 눌러서 만든 동화책을 모아보는 책장으로 이동해보세요.',
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
    description: '새로운 여행 이야기를 만들려면 이 버튼을 눌러 시작합니다.',
  },
  {
    id: 'creation-mode',
    route: ROUTES.mainBookshelf,
    selector: '[data-onboarding-target="creation-mode-viewer"]',
    title: '동화 형식 선택',
    description: '처음에는 기본 그림책 모드로 시작해보세요.',
  },
  {
    id: 'creation-basic-info',
    route: ROUTES.creation,
    selector: '[data-onboarding-target="creation-basic-info"]',
    title: '동화책 기본 정보',
    description: '주인공, 여행 일정, 장소를 입력하면 AI가 이야기를 만들 준비를 해요.',
  },
]
