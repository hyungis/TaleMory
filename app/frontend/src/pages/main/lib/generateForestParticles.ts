/**
 * 숲 씬에서 위로 부드럽게 떠오르는 작은 파티클(먼지/반딧불이 느낌) 좌표 데이터.
 * main.css 의 `.particle` 에서 CSS 변수 `--duration / --delay / --drift` 를 소비해
 * `floatUp` 키프레임으로 움직인다.
 */

export interface ForestParticle {
  id: number
  /** 가로 위치 (0~100%) */
  left: string
  /** 점 크기 (2~6px 랜덤) */
  size: string
  /** 애니메이션 1회 재생 시간 (8~20s 랜덤) */
  duration: string
  /** 시작 지연 (0~10s 랜덤) */
  delay: string
  /** 위로 떠오르며 약간씩 옆으로 흔들리는 x-offset */
  drift: string
}

export function generateForestParticles(count: number = 20): ForestParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    size: `${2 + Math.random() * 4}px`,
    duration: `${8 + Math.random() * 12}s`,
    delay: `${Math.random() * 10}s`,
    drift: `${(Math.random() - 0.5) * 80}px`,
  }))
}
