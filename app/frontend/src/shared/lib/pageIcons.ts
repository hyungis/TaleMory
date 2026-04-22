import {
  PlaneTakeoff,
  Waves,
  IceCream,
  Shell,
  Sun,
  Tent,
  Fish,
  TreePalm,
  Cake,
  Heart,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'

/**
 * 스토리보드 페이지 data.icon(kebab-case 문자열) → lucide-react 컴포넌트 매핑.
 * 원본 App.jsx 의 `<i data-lucide={p.icon}>` 동적 렌더를 React 컴포넌트 방식으로 대체.
 *
 * story-creation(편집) 과 viewer(완성 스토리 렌더) 양쪽에서 쓰이는 공통 룩업이므로
 * feature 에 두지 않고 shared 에 둔다.
 */
export const PAGE_ICON_MAP: Record<string, LucideIcon> = {
  'plane-takeoff': PlaneTakeoff,
  waves: Waves,
  'ice-cream': IceCream,
  'ice-cream-cone': IceCream,
  shell: Shell,
  sun: Sun,
  tent: Tent,
  fish: Fish,
  palmtree: TreePalm,
  cake: Cake,
  heart: Heart,
}

export function getPageIcon(name: string): LucideIcon {
  return PAGE_ICON_MAP[name] ?? BookOpen
}
