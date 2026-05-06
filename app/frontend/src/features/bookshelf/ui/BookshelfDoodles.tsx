/**
 * 책장 페이지 배경에 흩뿌려진 손그림 데코.
 * Claude 디자인 1:1 이식 — crayon/colored-pencil 시그니처:
 *  - SVG 라인 드로잉 + feTurbulence + feDisplacementMap (`crayon-rough` filter) 로 거친 손그림 결.
 *  - 색상: ink #a37548 / sky #9bbcd6 / sage #7a9968 / caramel #b8a684 / rust #c47254 / butter #d9a04a / rose #d99a9a.
 *  - 위치는 viewport 비율 (% / vw) 로 잡아 모니터 크기에 비례 배치.
 */
export function BookshelfDoodles() {
  return (
    <>
      {/* SVG defs — crayon-rough 필터 (한 번만 정의, 모든 doodle 이 url(#crayon-rough) 로 참조). */}
      <svg
        width="0"
        height="0"
        style={{ position: 'absolute' }}
        aria-hidden="true"
      >
        <defs>
          <filter id="crayon-rough" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="1.2" />
          </filter>
        </defs>
      </svg>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ zIndex: 0 }}
      >
        {/* Cloud 1 — top-left */}
        <DoodleCloud1 style={{ top: '6%', left: '5%', width: 110 }} />
        {/* Cloud 2 — top-right */}
        <DoodleCloud2 style={{ top: '12%', right: '8%', width: 90, opacity: 0.4 }} />
        {/* Stars 4종 */}
        <DoodleStar style={{ top: '8%', left: '38%', width: 38 }} color="#d9a04a" w={2.6} />
        <DoodleStar style={{ top: '22%', right: '22%', width: 28 }} color="#c47254" w={2.4} />
        <DoodleStar style={{ bottom: '18%', left: '7%', width: 32 }} color="#7a9968" w={2.4} />
        <DoodleStar style={{ top: '55%', right: '5%', width: 26 }} color="#a37548" w={2.2} />
        {/* Leaves */}
        <DoodleLeaf1 style={{ top: '30%', left: '3%', width: 70, transform: 'rotate(-15deg)' }} />
        <DoodleLeaf2 style={{ bottom: '8%', right: '10%', width: 80, transform: 'rotate(20deg)' }} />
        {/* Flowers */}
        <DoodleFlower style={{ bottom: '12%', left: '30%', width: 55 }} petal="#d99a9a" center="#f0c97a" />
        <DoodleFlower style={{ top: '45%', left: '12%', width: 42 }} petal="#c47254" center="#f0c97a" />
        {/* Bird */}
        <DoodleBird style={{ top: '18%', left: '60%', width: 60 }} />
        {/* Mountain */}
        <DoodleMountain style={{ bottom: '4%', left: '2%', width: 220, opacity: 0.32 }} />
        {/* Sun */}
        <DoodleSun style={{ top: '4%', right: '32%', width: 70, opacity: 0.45 }} />
        {/* House */}
        <DoodleHouse style={{ bottom: '6%', right: '32%', width: 90, opacity: 0.38 }} />
        {/* Heart */}
        <DoodleHeart style={{ top: '38%', right: '12%', width: 30 }} />
        {/* Rainbow */}
        <DoodleRainbow style={{ top: '60%', left: '45%', width: 120, opacity: 0.32 }} />
      </div>
    </>
  )
}

/* ─────────────────── doodle SVG components ─────────────────── */

interface DoodleStyle {
  top?: string
  bottom?: string
  left?: string
  right?: string
  width: number
  opacity?: number
  transform?: string
}

const baseSvg = (s: DoodleStyle): React.CSSProperties => ({
  position: 'absolute',
  top: s.top,
  bottom: s.bottom,
  left: s.left,
  right: s.right,
  width: s.width,
  opacity: s.opacity ?? 0.5,
  transform: s.transform,
  filter: 'url(#crayon-rough)',
})

const strokeProps = (color: string, w: number) => ({
  stroke: color,
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
})

function DoodleCloud1({ style }: { style: DoodleStyle }) {
  return (
    <svg style={baseSvg(style)} viewBox="0 0 110 60">
      <path
        d="M15,42 Q5,42 8,30 Q5,18 22,22 Q24,8 42,14 Q56,4 64,18 Q82,12 86,28 Q102,28 100,42 Q102,52 88,52 L20,52 Q8,52 15,42 Z"
        {...strokeProps('#9bbcd6', 2.6)}
      />
      <path d="M28,30 Q34,26 40,30" {...strokeProps('#9bbcd6', 1.8)} />
    </svg>
  )
}

function DoodleCloud2({ style }: { style: DoodleStyle }) {
  return (
    <svg style={baseSvg(style)} viewBox="0 0 110 60">
      <path
        d="M18,40 Q6,38 12,28 Q10,18 26,22 Q30,8 48,16 Q66,8 72,24 Q90,22 90,38 Q92,48 78,48 L24,48 Q12,48 18,40 Z"
        {...strokeProps('#b8a684', 2.4)}
      />
    </svg>
  )
}

function DoodleStar({ style, color, w }: { style: DoodleStyle; color: string; w: number }) {
  return (
    <svg style={baseSvg(style)} viewBox="0 0 40 40">
      <path
        d="M20,4 L24,16 L36,18 L27,26 L30,38 L20,32 L10,38 L13,26 L4,18 L16,16 Z"
        {...strokeProps(color, w)}
      />
    </svg>
  )
}

function DoodleLeaf1({ style }: { style: DoodleStyle }) {
  return (
    <svg style={baseSvg(style)} viewBox="0 0 80 80">
      <path d="M12,68 Q22,30 64,12 Q60,46 30,72 Q22,76 12,68 Z" {...strokeProps('#7a9968', 2.6)} />
      <path d="M16,64 Q34,42 58,18" {...strokeProps('#5f7d50', 2)} />
      <path d="M28,56 L36,52 M36,46 L42,42 M44,38 L50,34" {...strokeProps('#5f7d50', 1.6)} />
    </svg>
  )
}

function DoodleLeaf2({ style }: { style: DoodleStyle }) {
  return (
    <svg style={baseSvg(style)} viewBox="0 0 80 80">
      <path d="M14,12 Q56,16 72,60 Q40,68 16,42 Q10,28 14,12 Z" {...strokeProps('#a37548', 2.6)} />
      <path d="M20,18 Q40,38 64,56" {...strokeProps('#7a5430', 2)} />
    </svg>
  )
}

function DoodleFlower({
  style,
  petal,
  center,
}: {
  style: DoodleStyle
  petal: string
  center: string
}) {
  return (
    <svg style={baseSvg(style)} viewBox="0 0 60 60">
      <circle cx="30" cy="14" r="7" {...strokeProps(petal, 2.4)} />
      <circle cx="46" cy="30" r="7" {...strokeProps(petal, 2.4)} />
      <circle cx="30" cy="46" r="7" {...strokeProps(petal, 2.4)} />
      <circle cx="14" cy="30" r="7" {...strokeProps(petal, 2.4)} />
      <circle cx="30" cy="30" r="6" {...strokeProps(center, 2.4)} />
    </svg>
  )
}

function DoodleBird({ style }: { style: DoodleStyle }) {
  return (
    <svg style={baseSvg(style)} viewBox="0 0 80 50">
      <path d="M8,30 Q22,12 38,28 Q54,12 72,28" {...strokeProps('#7a5430', 2.4)} />
      <path d="M22,28 Q30,22 38,28" {...strokeProps('#7a5430', 1.8)} />
    </svg>
  )
}

function DoodleMountain({ style }: { style: DoodleStyle }) {
  return (
    <svg style={baseSvg(style)} viewBox="0 0 220 80">
      <path
        d="M4,76 L52,18 L88,52 L120,8 L160,48 L196,22 L216,76 Z"
        {...strokeProps('#a37548', 2.4)}
      />
      <path
        d="M44,30 L48,26 M50,28 L54,22 M52,32 L56,28"
        {...strokeProps('#a37548', 1.6)}
      />
      <path d="M114,18 L120,12 L126,18" {...strokeProps('#a37548', 1.6)} />
    </svg>
  )
}

function DoodleSun({ style }: { style: DoodleStyle }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <svg style={baseSvg(style)} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="14" {...strokeProps('#d9a04a', 2.6)} />
      {rays.map(a => {
        const r1 = 22
        const r2 = 32
        const x1 = 40 + r1 * Math.cos((a * Math.PI) / 180)
        const y1 = 40 + r1 * Math.sin((a * Math.PI) / 180)
        const x2 = 40 + r2 * Math.cos((a * Math.PI) / 180)
        const y2 = 40 + r2 * Math.sin((a * Math.PI) / 180)
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} {...strokeProps('#d9a04a', 2.4)} />
      })}
    </svg>
  )
}

function DoodleHouse({ style }: { style: DoodleStyle }) {
  return (
    <svg style={baseSvg(style)} viewBox="0 0 100 80">
      <path d="M14,72 L14,38 L50,12 L86,38 L86,72 Z" {...strokeProps('#a37548', 2.6)} />
      <path d="M50,12 L50,4" {...strokeProps('#a37548', 2.2)} />
      <rect x="40" y="48" width="20" height="24" {...strokeProps('#7a5430', 2.2)} />
      <rect x="22" y="44" width="12" height="12" {...strokeProps('#7a5430', 2)} />
      <rect x="66" y="44" width="12" height="12" {...strokeProps('#7a5430', 2)} />
      <path d="M68,38 L68,18 L78,18 L78,38" {...strokeProps('#c47254', 2.2)} />
    </svg>
  )
}

function DoodleHeart({ style }: { style: DoodleStyle }) {
  return (
    <svg style={baseSvg(style)} viewBox="0 0 40 40">
      <path
        d="M20,34 C8,26 4,18 4,12 C4,6 9,3 14,5 C17,6 19,9 20,12 C21,9 23,6 26,5 C31,3 36,6 36,12 C36,18 32,26 20,34 Z"
        {...strokeProps('#c47254', 2.6)}
      />
    </svg>
  )
}

function DoodleRainbow({ style }: { style: DoodleStyle }) {
  return (
    <svg style={baseSvg(style)} viewBox="0 0 120 60">
      <path d="M8,52 Q60,-4 112,52" {...strokeProps('#c47254', 3)} />
      <path d="M16,52 Q60,4 104,52" {...strokeProps('#d9a04a', 3)} />
      <path d="M24,52 Q60,12 96,52" {...strokeProps('#7a9968', 3)} />
      <path d="M32,52 Q60,20 88,52" {...strokeProps('#9bbcd6', 3)} />
    </svg>
  )
}
