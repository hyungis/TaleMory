/**
 * 랜딩 종료 시 "시작하기" 버튼 위치에서 사방으로 퍼져나가는 나비 떼의 좌표/속도 데이터.
 * 결과는 HomePage 에서 useMemo 로 한 번만 생성하여 리렌더 방지.
 */

export interface SwarmParticle {
  id: number
  /** 최종 x 이동량(px). 버튼 중심 기준 */
  tx: number
  /** 최종 y 이동량(px). 버튼 중심 기준 */
  ty: number
  /** 애니메이션 시작 지연(초) */
  delay: number
  /** 개별 개체의 비행 시간(초) */
  duration: number
  /** Lottie 색상 hue-rotate(deg) */
  hue: number
  /** Lottie 재생 속도 */
  speed: number
  /** 시각적 크기 배율 */
  scale: number
}

export function generateSwarmParticles(count: number = 17): SwarmParticle[] {
  return Array.from({ length: count }, (_, i) => {
    const baseAngle = (i / count) * 360
    const jitter = (Math.random() - 0.5) * 24
    const angle = baseAngle + jitter
    const rad = (angle * Math.PI) / 180
    const dist = 560 + Math.random() * 460
    return {
      id: i,
      tx: Math.cos(rad) * dist,
      ty: Math.sin(rad) * dist - (140 + Math.random() * 220),
      delay: Math.random() * 0.4,
      duration: 1.7 + Math.random() * 0.75,
      hue: Math.floor(Math.random() * 360),
      speed: 0.7 + Math.random() * 0.7,
      scale: 0.85 + Math.random() * 0.65,
    }
  })
}
