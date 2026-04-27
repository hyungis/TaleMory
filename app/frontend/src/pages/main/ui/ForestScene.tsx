import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { generateForestParticles } from '../lib/generateForestParticles'
import { TopRightMenu } from './TopRightMenu'

interface ForestSceneProps {
  /**
   * 집 문 열림 + 빨려들어가는 zoom 인터랙션 후 호출. 상위에서 BookstoreScene 으로 전환 트리거.
   */
  onEnterBookstore?: () => void
}

/**
 * 인터랙션 phase.
 *  - idle: 평상 상태
 *  - opening: 클릭 직후. 문이 열린 (`/openhouse.png`) 모습이 보이며 사용자에게 "열렸다" 를 인지시킴.
 *  - zooming: 그 직후 화면이 문으로 빨려들어가듯 zoom-in + opacity fade-out + door-light burst.
 */
type ForestPhase = 'idle' | 'opening' | 'zooming'

/**
 * 로그인 직후 진입하는 숲 씬.
 * 배경 / 나무 / 집 / 빛줄기 / 비네팅 / 부유 파티클 레이어 조합.
 *
 * 클릭 인터랙션은 phase 머신으로 두 단계로 분리:
 *   1) opening — 문이 열린 모습을 사용자에게 충분히 보여줌 (openMs)
 *   2) zooming — 화면이 문 쪽으로 줌인하면서 fade-out, 거의 끝날 즈음 onEnterBookstore() 호출
 * cleanupMs 뒤 phase 를 idle 로 reset 해서 BookstoreScene 의 ← 로 돌아왔을 때 다시 닫힌 집이 보이게 한다.
 */
export function ForestScene({ onEnterBookstore }: ForestSceneProps) {
  const particles = useMemo(() => generateForestParticles(), [])
  const [phase, setPhase] = useState<ForestPhase>('idle')
  const timersRef = useRef<number[]>([])

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(id => window.clearTimeout(id))
    timersRef.current = []
  }, [])

  const handleHouseClick = useCallback(() => {
    if (phase !== 'idle') return

    // 단계별 시간(ms).
    const openMs = 500 // 문이 열린 모습이 보이는 시간 (zoom 시작 전)
    const zoomMs = 750 // .scene 의 zoom-in transition 길이 (CSS 와 동기화)
    const cleanupMs = 800 // BookstoreScene crossfade(0.5s) 가 끝난 뒤 phase reset 까지 여유

    setPhase('opening')

    // 문이 충분히 보인 뒤 zoom 단계로.
    const t1 = window.setTimeout(() => setPhase('zooming'), openMs)
    // zoom 이 거의 끝나갈 즈음(85%) BookstoreScene 으로 crossfade 시작 → 자연스럽게 이어짐.
    const t2 = window.setTimeout(
      () => onEnterBookstore?.(),
      openMs + Math.round(zoomMs * 0.85),
    )
    // BookstoreScene 으로 가려진 뒤 idle 로 reset (다음 진입 시 닫힌 집부터 다시 시작).
    const t3 = window.setTimeout(
      () => setPhase('idle'),
      openMs + zoomMs + cleanupMs,
    )

    timersRef.current.push(t1, t2, t3)
  }, [phase, onEnterBookstore])

  // 언마운트 시 모든 pending timer 정리.
  useEffect(() => {
    return clearAllTimers
  }, [clearAllTimers])

  const isInteracting = phase !== 'idle'
  const isZooming = phase === 'zooming'

  return (
    <div className={`scene${isZooming ? ' is-entering' : ''}`}>
      {/* 우상단 햄버거 메뉴 — 마이페이지 / 로그아웃 진입.
          standalone=true 로 자체 absolute 위치를 잡는다 (BookstoreScene 과 달리
          여기엔 우상단 액션 버튼 그룹이 없으므로). */}
      <TopRightMenu standalone />

      {/* 레이어 1: 배경 숲 */}
      <div className="layer layer--background">
        <img src="/background.png" alt="숲 배경" draggable={false} />
      </div>

      {/* 레이어 2: 나무 프레임 (sway 애니메이션) */}
      <div className="layer layer--tree">
        <img src="/tree.png" alt="나무 프레임" draggable={false} />
      </div>

      {/* 레이어 3: 집 (bobbing + 클릭 시 openhouse 로 교체 후 씬 전환).
          PNG 투명 여백까지 클릭되지 않도록, 이미지 자체는 pointer-events: none 이고
          위에 덮인 .house-hitbox 가 실제 silhouette 크기로 클릭을 받는다. */}
      <div className="layer layer--house">
        <div className="house-wrapper">
          <img
            src={isInteracting ? '/openhouse.png' : '/house.png'}
            alt="숲속의 집"
            className="house-img"
            draggable={false}
          />
          <button
            type="button"
            className="house-hitbox"
            onClick={handleHouseClick}
            aria-label="집에 들어가기"
            disabled={isInteracting}
          />

          {/* 문 위 펄싱 마커(외곽 링 + 내부 점) + 안내 멘트.
              pointer-events: none 으로 클릭은 hitbox 가 그대로 받는다.
              상호작용이 시작되면(opening/zooming) 자연스럽게 fade-out. */}
          <div
            className={`house-knock-marker${isInteracting ? ' is-hidden' : ''}`}
            aria-hidden="true"
          >
            <div className="house-knock-marker__indicator">
              <span className="house-knock-marker__ring" />
              <span className="house-knock-marker__dot" />
            </div>
            <span className="house-knock-marker__label">문을 두드려보세요</span>
          </div>
        </div>
      </div>

      {/* 빛줄기 */}
      <div className="light-rays" />

      {/* 비네팅 */}
      <div className="vignette" />

      {/* 문 안에서 새어나오는 빛 — zooming phase 일 때 fade-in + scale 확장 으로
          "빨려들어가는" 인상을 강화. pointer-events: none. */}
      <div className="door-light" aria-hidden="true" />

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
