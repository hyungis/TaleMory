import type { CSSProperties } from 'react'
import { Butterfly } from './Butterfly'
import type { SwarmParticle } from '../lib/generateSwarmParticles'

interface ButterflySwarmProps {
  animationData: unknown
  particles: SwarmParticle[]
}

/**
 * 랜딩 종료 시 "시작하기" 버튼 위치(`position: fixed`, bottom 10vh + 30px offset)에서
 * 사방으로 퍼지는 나비 떼. CSS custom property(--tx, --ty, --delay, --duration, --scale) 를
 * 각 개체에 전달 → `.butterfly` 키프레임이 이를 기반으로 이동/페이드.
 */
export function ButterflySwarm({ animationData, particles }: ButterflySwarmProps) {
  if (!animationData) return null
  return (
    <div className="butterfly-swarm">
      {particles.map(b => (
        <div
          key={b.id}
          className="butterfly"
          style={
            {
              '--tx': `${b.tx}px`,
              '--ty': `${b.ty}px`,
              '--delay': `${b.delay}s`,
              '--duration': `${b.duration}s`,
              '--scale': b.scale,
            } as unknown as CSSProperties
          }
        >
          <Butterfly animationData={animationData} hue={b.hue} speed={b.speed} />
        </div>
      ))}
    </div>
  )
}
