import { useCallback, useMemo, type CSSProperties } from 'react'
import { generateForestParticles } from '../lib/generateForestParticles'

/**
 * 로그인 직후 진입하는 숲 씬.
 * 배경 / 나무 / 집 / 빛줄기 / 비네팅 / 부유 파티클 레이어 조합.
 *
 * 현재는 정적 렌더 + 집 클릭 스텁.
 * TODO(S14P31S210-76, Task 1b): Lottie 걷는 아이 + RAF 걷기 애니메이션 + bookstore 씬 전환.
 */
export function ForestScene() {
  const particles = useMemo(() => generateForestParticles(), [])

  const handleHouseClick = useCallback(() => {
    // TODO(S14P31S210-76, Task 1b): RAF 걷기 애니 + 문 열림 + 씬 전환.
    // eslint-disable-next-line no-console
    console.log('[ForestScene] house clicked — walking kid animation coming in next commit')
  }, [])

  return (
    <div className="scene">
      {/* 레이어 1: 배경 숲 */}
      <div className="layer layer--background">
        <img src="/background.png" alt="숲 배경" draggable={false} />
      </div>

      {/* 레이어 2: 나무 프레임 (sway 애니메이션) */}
      <div className="layer layer--tree">
        <img src="/tree.png" alt="나무 프레임" draggable={false} />
      </div>

      {/* 레이어 3: 집 (bobbing + hover scale) */}
      <div className="layer layer--house">
        <div className="house-wrapper">
          <img
            src="/house.png"
            alt="숲속의 집"
            className="house-img"
            onClick={handleHouseClick}
            draggable={false}
          />
        </div>
      </div>

      {/* 빛줄기 */}
      <div className="light-rays" />

      {/* 비네팅 */}
      <div className="vignette" />

      {/* 부유 파티클 */}
      <div className="particles">
        {particles.map(p => (
          <div
            key={p.id}
            className="particle"
            style={
              {
                left: p.left,
                width: p.size,
                height: p.size,
                '--duration': p.duration,
                '--delay': p.delay,
                '--drift': p.drift,
              } as unknown as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  )
}
