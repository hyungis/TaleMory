import type { MainCharacterPayload, StoryDraftResponse } from '../api/types'

interface DraftResumeBannerProps {
  /** 서버에서 받아온 진행 중 DRAFT. null 이면 배너 자체가 렌더되지 않아야 함. */
  draft: StoryDraftResponse
  /** "이어서 만들기" 클릭 — 부모가 navigate(/creation, { state: { draft } }) 처리. */
  onResume: () => void
}

/**
 * 책장 상단의 "진행 중인 동화" 배너.
 *
 * 디자인 요소:
 *  - cream-yellow 그라디언트 + caramel-deep border + 입체 `0 2px 0` shadow
 *  - 좌상단 워시 테이프 (yellow + caramel)
 *  - 좌측: "✦ 가장 최근 동화 · IN PROGRESS" 태그 + Nanum Myeongjo 30px 제목 + Gaegu 부제
 *  - 우측: butter `#f0c97a` pill CTA + 손그림 화살표 SVG
 */
export function DraftResumeBanner({ draft, onResume }: DraftResumeBannerProps) {
  const titleText = buildDisplayTitle(draft)
  const subtitleParts = formatSubtitleParts(draft.travelPlace, draft.travelStartDate, draft.travelEndDate)
  const startedAt = formatRelativeTime(draft.createdAt)
  const difficultyLabel = formatDifficulty(draft.difficulty)

  return (
    <section
      className="bookshelf-fade-in relative"
      aria-label="진행 중인 동화"
      style={{
        background: 'linear-gradient(135deg, #fbf2da 0%, #f5e6bd 100%)',
        border: '2.5px solid #a37548',
        borderRadius: 20,
        padding: '22px 28px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 22,
        alignItems: 'center',
        marginBottom: 36,
        boxShadow: '0 2px 0 #a37548, 0 8px 22px rgba(140, 100, 60, 0.18)',
      }}
    >
      {/* 워시 테이프 1 — 좌상단 yellow */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -14,
          left: 24,
          width: 80,
          height: 24,
          background: 'rgba(255, 230, 140, 0.55)',
          border: '1px dashed rgba(150, 110, 50, 0.3)',
          transform: 'rotate(-4deg)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        }}
      />
      {/* 워시 테이프 2 — 우상단 caramel */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -10,
          right: 38,
          width: 70,
          height: 22,
          background: 'rgba(216, 165, 124, 0.4)',
          border: '1px dashed rgba(150, 110, 50, 0.3)',
          transform: 'rotate(6deg)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        }}
      />

      {/* 좌측: tag / 제목 / info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            color: '#5f7d50',
            letterSpacing: '0.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 2,
          }}
        >
          <span style={{ color: '#5f7d50' }}>✦</span>
          <span>가장 최근 동화</span>
          <span style={{ color: '#a37548' }}>·</span>
          <span
            style={{
              background: '#ead08a',
              color: '#6b4a18',
              padding: '1px 9px',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.8px',
            }}
          >
            IN PROGRESS
          </span>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display-serif)',
            fontSize: 32,
            margin: '2px 0 6px',
            color: '#4a3b2a',
            fontWeight: 700,
            letterSpacing: '-0.5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {titleText}
        </h2>
        {subtitleParts.length > 0 && (
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              color: '#6b5638',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {subtitleParts.map((part, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && <span style={{ color: '#c89968' }}>·</span>}
                <span>{part}</span>
              </span>
            ))}
          </div>
        )}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            color: '#8a7558',
            marginTop: 2,
          }}
        >
          시작 {startedAt} · {difficultyLabel}
        </div>
      </div>

      {/* 우측: butter pill CTA */}
      <button
        type="button"
        onClick={onResume}
        style={{
          background: '#f0c97a',
          color: '#5b3a18',
          border: '2px solid #a37548',
          padding: '14px 26px',
          borderRadius: 999,
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 3px 0 #a37548, 0 6px 14px rgba(140,100,50,0.25)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          whiteSpace: 'nowrap',
        }}
      >
        이어서 만들기
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
          <path
            d="M2,7 L14,7 M9,2 L14,7 L9,12"
            stroke="#5b3a18"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </section>
  )
}

/* ──────────────────── helpers ──────────────────── */

function buildDisplayTitle(draft: StoryDraftResponse): string {
  const names = parseChildNames(draft.mainCharacterJson)
  if (names.length === 1) return `${names[0]}의 새 동화`
  if (names.length > 1) return `${names[0]} 외 ${names.length - 1}명의 새 동화`

  return '작성 중인 동화'
}

function parseChildNames(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(c => (c as Partial<MainCharacterPayload>).name?.trim())
      .filter((n): n is string => Boolean(n))
  } catch {
    return []
  }
}

/** 부제 — 여행지 + 일정. Claude 디자인은 두 부분을 sep `·` 로 잇고 일정은 `~` 로 묶음. */
function formatSubtitleParts(
  place: string | null,
  start: string | null,
  end: string | null,
): string[] {
  const parts: string[] = []
  if (place && place.trim()) parts.push(place.trim())
  const range = formatDateRange(start, end)
  if (range) parts.push(range)
  return parts
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null
  if (start && end && start !== end) return `${start} ~ ${end}`
  return start ?? end
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const diffMs = Date.now() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return '방금 전'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  if (day < 28) return `${Math.floor(day / 7)}주 전`
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function formatDifficulty(d: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'): string {
  switch (d) {
    case 'BEGINNER':
      return '초급'
    case 'INTERMEDIATE':
      return '중급'
    case 'ADVANCED':
      return '고급'
  }
}
