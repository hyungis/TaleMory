import type { StylePreset } from '../../model/types'

export interface StyleOptionDef {
  id: StylePreset
  name: string
  desc: string
  recommended?: boolean
  /** 미리보기 카드 배경 Tailwind 클래스 */
  bg: string
}

/**
 * 삽화 스타일 프리셋 목록. 원본 App.jsx 의 STYLE_OPTIONS 와 동기.
 * 실제 백엔드의 style_presets 테이블 데이터로 교체 가능.
 */
export const STYLE_OPTIONS: readonly StyleOptionDef[] = [
  {
    id: 'watercolor',
    name: '수채화 (추천)',
    desc: '따뜻하고 부드러운 감성의 기본 스타일',
    recommended: true,
    bg: 'bg-gradient-to-br from-[#e8ddb4] to-[#b4dc8c]/60',
  },
  {
    id: 'digital',
    name: '디지털 페인팅',
    desc: '애니메이션(Pixar) 같이 생동감 넘치는 스타일',
    bg: 'bg-gradient-to-br from-[#b4dc8c]/50 to-[#8b7a52]/40',
  },
  {
    id: 'crayon',
    name: '색연필 만화',
    desc: '아이들이 직접 그린 듯한 귀여운 스타일',
    bg: 'bg-gradient-to-br from-[#f0e6c0] to-[#c97b4a]/40',
  },
  {
    id: 'line',
    name: '라인 드로잉',
    desc: '깔끔하고 세련된 스케치 스타일',
    bg: 'bg-[#f0e6c0] border-2 border-dashed border-[#b4dc8c]/70',
  },
  {
    id: 'collage',
    name: '콜라주',
    desc: '종이를 오려 붙인 듯한 독특한 스타일',
    bg: 'bg-gradient-to-tr from-[#d6c78e] to-[#f0e6c0]',
  },
] as const
