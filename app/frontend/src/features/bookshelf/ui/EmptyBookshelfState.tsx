/**
 * 책장 비어있을 때 노출되는 빈 상태.
 * Claude 디자인 EmptyIllustration 1:1 — 펼쳐진 책 + 별 + 작은 dot + 무지개 SVG.
 * Pen Script 손글씨 32px + Gaegu 부제 + made with ♥ for our family 푸터.
 */
export function EmptyBookshelfState() {
  return (
    <div className="text-center mt-12 px-6 relative z-10">
      <svg
        viewBox="0 0 200 160"
        width="200"
        height="160"
        style={{ filter: 'url(#crayon-rough)', display: 'inline-block' }}
      >
        {/* open book */}
        <path
          d="M30,120 L100,100 L170,120 L170,60 L100,42 L30,60 Z"
          fill="#f7eccd"
          stroke="#a37548"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path d="M100,42 L100,100" stroke="#a37548" strokeWidth="2.2" />
        <path
          d="M50,72 L88,64 M50,82 L88,74 M50,92 L88,84"
          stroke="#a37548"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M112,64 L150,72 M112,74 L150,82 M112,84 L150,92"
          stroke="#a37548"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {/* sparkle */}
        <path
          d="M154,36 L158,46 L168,48 L160,54 L162,64 L154,58 L146,64 L148,54 L140,48 L150,46 Z"
          fill="none"
          stroke="#d9a04a"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="40" cy="36" r="3" fill="#c47254" />
        <circle cx="180" cy="80" r="3" fill="#7a9968" />
      </svg>

      <div
        className="mt-3"
        style={{
          fontFamily: 'var(--font-display-pen)',
          fontSize: '32px',
          color: '#6b5638',
        }}
      >
        아직 만들어진 동화책이 없어요
      </div>
      <div
        className="mt-1.5"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          color: '#8a7558',
        }}
      >
        우리 가족의 첫 여행 이야기를 시작해 볼까요?
      </div>
    </div>
  )
}
