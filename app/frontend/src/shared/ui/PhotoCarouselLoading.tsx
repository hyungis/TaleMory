import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import './PhotoCarouselLoading.css'

interface PhotoCarouselLoadingProps {
  /**
   * 사용자가 올린 사진 URL 배열.
   *
   * 비어있으면 paper-craft 톤 스피너로 폴백 — 사진 fetch 가 아직 안 끝났거나
   * 업로드된 사진이 없는 경우 (예: 직접 진입한 stale URL). caller 는 usePhotosQuery
   * 등으로 미리 가져와 `imageUrl` 만 추려서 prop 으로 전달한다.
   */
  photos: ReadonlyArray<string>
  /** 큰 제목 — 예: "AI 가 줄거리를 만들고 있어요". */
  title: string
  /** 보조 메시지 — 예: "잠시만 기다려주세요.". */
  subtitle?: string
  /**
   * 한 사진 노출 시간 (ms). default 2500ms.
   *
   * 너무 짧으면 사진이 휙휙 지나가 인지되기 전에 사라지고, 너무 길면 진행감이 약해진다.
   * `photo-carousel-fade` keyframes 의 총 길이와 맞춰서 fade-in/out 이 자연스럽게 이어지도록.
   */
  intervalMs?: number
  /**
   * 크기 변형.
   *  - `default`: Step 3/4 본문 생성 / Step 8 최종 로딩처럼 전체 화면 중앙 카드용.
   *  - `compact`: 페이지 카드 내부 같은 좁은 공간 (예: cr-sketch-regen-overlay) 용.
   *    stage / 타이틀 / 점 인디케이터 모두 비율 축소.
   */
  size?: 'default' | 'compact'
}

/**
 * 로딩 화면 공용 컴포넌트 — 사용자가 업로드한 사진을 하나씩 fade in/out 으로 사이클한다.
 *
 * 동화 생성 플로우의 여러 로딩 지점에서 동일한 UX 로 재사용하기 위해 `shared/ui` 에 둠.
 * 사진 fetch (usePhotosQuery 등) 는 caller 책임 — 본 컴포넌트는 순수 표현 컴포넌트로
 * 사진 URL 배열만 받아 사이클 렌더한다. 사진이 없으면 단순 스피너 폴백.
 */
export function PhotoCarouselLoading({
  photos,
  title,
  subtitle,
  intervalMs = 2500,
  size = 'default',
}: PhotoCarouselLoadingProps) {
  const [index, setIndex] = useState(0)

  // 사진이 1장 이하면 사이클 불필요 (정적 표시).
  useEffect(() => {
    if (photos.length <= 1) return
    const id = window.setInterval(() => {
      setIndex(prev => (prev + 1) % photos.length)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [photos.length, intervalMs])

  // photos 가 갱신돼 길이가 줄면 index 가 OOB 가 될 수 있어 modulo 로 안전화.
  const safeIndex = photos.length > 0 ? index % photos.length : 0
  const currentUrl = photos.length > 0 ? photos[safeIndex] : null

  const rootClass = `photo-carousel-loading${size === 'compact' ? ' photo-carousel-loading--compact' : ''}`

  return (
    <div className={rootClass}>
      <div className="photo-carousel-loading__stage" aria-hidden="true">
        {currentUrl ? (
          // key 에 index 를 포함해 매번 새 노드로 마운트 → CSS keyframes 재실행되며 fade.
          <img
            key={`${safeIndex}-${currentUrl}`}
            src={currentUrl}
            alt=""
            className="photo-carousel-loading__photo"
          />
        ) : (
          <Loader2 className="photo-carousel-loading__spinner" />
        )}
      </div>
      {photos.length > 1 && (
        <div className="photo-carousel-loading__dots" aria-hidden="true">
          {photos.map((_, i) => (
            <span
              key={i}
              className={`photo-carousel-loading__dot${i === safeIndex ? ' is-active' : ''}`}
            />
          ))}
        </div>
      )}
      <h2 className="photo-carousel-loading__title">{title}</h2>
      {subtitle && <p className="photo-carousel-loading__subtitle">{subtitle}</p>}
    </div>
  )
}
