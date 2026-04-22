import { useMemo, type CSSProperties } from 'react'
import { generateForestParticles } from '../lib/generateForestParticles'
import { useKidAnim } from '../model/useKidAnim'
import { useHouseWalk } from '../model/useHouseWalk'
import { WalkingKid } from './WalkingKid'

interface ForestSceneProps {
  /**
   * 아이가 집 앞 도착 + 문 열림 후 호출. 상위에서 BookstoreScene 으로 전환 트리거.
   */
  onEnterBookstore?: () => void
}

/**
 * 로그인 직후 진입하는 숲 씬.
 * 배경 / 나무 / 집 / 빛줄기 / 비네팅 / 부유 파티클 / 걷는 아이 레이어 조합.
 *
 * 집 클릭 → `useHouseWalk` 가 RAF 로 아이를 문 앞까지 이동시키고, 도착 시 문이 열림(openhouse.png).
 * 도착 + lingerMs(400ms) 후 `onEnterBookstore` 호출 → 상위 MainPage 가 씬 전환.
 */
export function ForestScene({ onEnterBookstore }: ForestSceneProps) {
  const particles = useMemo(() => generateForestParticles(), [])
  const kidAnim = useKidAnim()
  const { isKidWalking, showBackView, kidRef, startWalking } = useHouseWalk({
    onArrive: onEnterBookstore,
  })

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

      {/* 레이어 3: 집 (bobbing + 아이 도착 시 openhouse 로 교체) */}
      <div className="layer layer--house">
        <div className="house-wrapper">
          <img
            src={showBackView ? '/openhouse.png' : '/house.png'}
            alt="숲속의 집"
            className="house-img"
            onClick={startWalking}
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

      {/* 걷는 아이 (집 클릭 시 문 앞까지 이동 + 문 열림 직후 뒷모습 PNG 스왑) */}
      <WalkingKid
        ref={kidRef}
        animationData={kidAnim}
        walking={isKidWalking}
        showBackView={showBackView}
      />
    </div>
  )
}
