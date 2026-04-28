import type { SVGProps } from 'react'

/**
 * 동화책 표지/삽화/스토리보드의 "실제 일러스트가 아직 없을 때" 보여주는 공용 목업 SVG.
 *
 * 구성:
 *  - 먼 산 실루엣 (레이어 2개)
 *  - 언덕 + 나무 실루엣
 *  - 달/태양 원
 *  - 별자리 점 몇 개
 *
 * currentColor 를 사용하므로 부모의 text-* 색상으로 톤 제어 가능.
 *
 * variant:
 *  - 'scenery': 기본 풍경 목업 (책 표지 / 스토리보드 스케치 배경)
 *  - 'minimal': 중앙 원 + 별 몇개만 (소형 아이콘 옆 장식용)
 */
interface IllustrationMockupProps extends SVGProps<SVGSVGElement> {
  variant?: 'scenery' | 'minimal'
  /**
   * 우상단 달/해 원을 표시할지. 'scenery' variant 에서만 의미 있음. 기본 true.
   * 책장 카드처럼 표지가 좁아 원이 거슬리는 경우 false 로 끈다.
   */
  showMoon?: boolean
}

export function IllustrationMockup({ variant = 'scenery', showMoon = true, ...rest }: IllustrationMockupProps) {
  if (variant === 'minimal') {
    return (
      <svg
        viewBox="0 0 200 60"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        {...rest}
      >
        <g fill="currentColor">
          <circle cx="20" cy="20" r="1.5" opacity="0.35" />
          <circle cx="60" cy="12" r="2" opacity="0.35" />
          <circle cx="140" cy="18" r="1.5" opacity="0.3" />
          <circle cx="180" cy="28" r="1" opacity="0.3" />
        </g>
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 200 120"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      {...rest}
    >
      {/* 별 */}
      <g fill="currentColor" opacity="0.55">
        <circle cx="28" cy="18" r="1.3" />
        <circle cx="52" cy="12" r="1" />
        <circle cx="80" cy="22" r="1.4" />
        <circle cx="168" cy="16" r="1.2" />
        <circle cx="186" cy="28" r="1" />
      </g>

      {/* 달/해 — showMoon=false 일 때 숨김 */}
      {showMoon && (
        <>
          <circle cx="150" cy="28" r="11" fill="currentColor" opacity="0.35" />
          <circle cx="150" cy="28" r="11" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.5" />
        </>
      )}

      {/* 먼 산 (뒤) */}
      <path
        d="M0,78 L25,58 L55,72 L85,50 L115,65 L145,48 L175,60 L200,52 L200,120 L0,120 Z"
        fill="currentColor"
        opacity="0.18"
      />
      {/* 언덕 (앞) */}
      <path
        d="M0,95 Q40,82 80,92 Q120,100 160,88 Q180,82 200,90 L200,120 L0,120 Z"
        fill="currentColor"
        opacity="0.3"
      />

      {/* 나무 실루엣 */}
      <g fill="currentColor" opacity="0.55">
        {/* 왼쪽 나무 */}
        <rect x="22" y="92" width="2" height="10" />
        <circle cx="23" cy="90" r="5" />
        {/* 가운데 작은 나무 */}
        <rect x="95" y="96" width="1.5" height="6" />
        <circle cx="95.8" cy="94" r="3" />
        {/* 오른쪽 큰 나무 */}
        <rect x="170" y="88" width="2.5" height="14" />
        <path d="M171 74 L178 90 L164 90 Z" />
      </g>

      {/* 풀 */}
      <g fill="currentColor" opacity="0.4">
        <path d="M10 108 l3 -5 l1 5 z" />
        <path d="M40 110 l2 -4 l1 4 z" />
        <path d="M120 110 l2 -4 l1 4 z" />
        <path d="M155 108 l3 -5 l1 5 z" />
      </g>
    </svg>
  )
}
