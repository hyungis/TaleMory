import { ArrowRight, Sparkles } from 'lucide-react'
import type { MainCharacterPayload, StoryDraftResponse } from '../api/types'

interface DraftResumeBannerProps {
  /** 서버에서 받아온 진행 중 DRAFT. null 이면 배너 자체가 렌더되지 않아야 함. */
  draft: StoryDraftResponse
  /** "이어서 만들기" 클릭 — 부모가 navigate(/creation, { state: { draft } }) 처리. */
  onResume: () => void
}

/**
 * 책장 상단에 항상 노출되는 "진행 중인 동화" 배너.
 *
 * 모달(DraftResumeModal)은 "새 동화책 만들기" 클릭 시에만 떠서 발견성이 낮았는데,
 * 이 배너는 책장 진입 즉시 보이게 해 사용자가 즉시 인지/이어쓰기 가능.
 * 모달 흐름은 그대로 유지 (discard + 새로 시작 분기 담당).
 *
 * 표시 정보:
 *  - 좌측: cover image placeholder (storyId 기반 picsum seed — 카드와 동일 패턴)
 *  - 라벨: "✨ 가장 최근 동화 · IN PROGRESS"
 *  - 제목: draft.title 또는 fallback "(제목 미정)"
 *  - 부제: travelPlace + 일정 또는 fallback
 *  - meta: 시작 시간(상대시간) + 난이도
 *  - 우측: "이어서 만들기 →" CTA
 */
export function DraftResumeBanner({ draft, onResume }: DraftResumeBannerProps) {
  const previewCoverUrl = `https://picsum.photos/seed/talemory-${draft.storyId}/200/280`
  const titleText = buildDisplayTitle(draft)
  const subtitle = formatSubtitle(draft.travelPlace, draft.travelStartDate, draft.travelEndDate)
  const startedAt = formatRelativeTime(draft.createdAt)
  const difficultyLabel = formatDifficulty(draft.difficulty)

  return (
    <section
      className="bookshelf-fade-in mb-10 bg-[#F4E4BC] border-2 border-[#B9D38F] rounded-3xl p-5 md:p-6 shadow-[0_4px_0_#9A7548]/30 flex flex-col md:flex-row items-stretch md:items-center gap-5 relative z-10"
      aria-label="진행 중인 동화"
    >
      {/* 좌측: cover image (정사각비 책 비율) */}
      <div className="shrink-0 w-24 md:w-28 aspect-[3/4] overflow-hidden rounded-xl border-2 border-[#9A7548]/30 shadow-sm bg-[#E9DBBE]">
        <img
          src={previewCoverUrl}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* 가운데: 라벨 + 제목 + 부제 + meta */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#3F6B2E] tracking-wider uppercase">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>가장 최근 동화 · In Progress</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-[#3E2A18] truncate">
          {titleText}
        </h2>
        {subtitle && (
          <p className="text-sm md:text-base text-[#6B4A28] line-clamp-1">{subtitle}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-[#76695A] uppercase tracking-wide font-bold mt-0.5">
          <span>시작 {startedAt}</span>
          <span aria-hidden="true">·</span>
          <span>{difficultyLabel}</span>
        </div>
      </div>

      {/* 우측: "이어서 만들기" CTA */}
      <button
        type="button"
        onClick={onResume}
        className="shrink-0 bg-[#8DBA64] text-[#1F3318] px-6 py-3 rounded-full border border-[#B9D38F] shadow-[0_3px_0_#3F6B2E] hover:translate-y-1 hover:shadow-[0_1px_0_#3F6B2E] hover:bg-[#A6CB45] transition-all font-bold flex items-center gap-2 text-base whitespace-nowrap self-start md:self-center"
      >
        이어서 만들기 <ArrowRight className="w-4 h-4" />
      </button>
    </section>
  )
}

/**
 * 표시용 제목 생성.
 *
 * Step 1 만 작성하고 빠져나간 케이스에선 BE 의 `title` 이 null 이라 "(제목 미정)" 으로 보이는데,
 * 이게 시각적으로 약하다 (사용자 입장에선 "내가 어떤 동화 만들고 있었지?" 안 떠오름).
 *
 * fallback 우선순위:
 *  1. title 이 있으면 그대로
 *  2. mainCharacterJson 의 첫 아이 이름으로 "OO이의 새 동화" 또는 "OO이 외 N명의 새 동화"
 *  3. 둘 다 없으면 "작성 중인 동화" (이론상 거의 도달 불가 — step 1 통과하려면 아이 1+ 필요)
 */
function buildDisplayTitle(draft: StoryDraftResponse): string {
  const explicit = draft.title?.trim()
  if (explicit) return explicit

  const names = parseChildNames(draft.mainCharacterJson)
  if (names.length === 1) return `${names[0]}의 새 동화`
  if (names.length > 1) return `${names[0]} 외 ${names.length - 1}명의 새 동화`

  return '작성 중인 동화'
}

/**
 * mainCharacterJson(JSON.stringify 된 array) 파싱 후 비어있지 않은 이름들만 추출.
 * 잘못된 JSON / 형태가 다르면 빈 배열 반환 — fallback 으로 자연스럽게 흐름.
 */
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

/**
 * 부제 — 여행지 + 일정 조합. 둘 다 없으면 null 반환 → 부제 자체를 숨김.
 */
function formatSubtitle(
  place: string | null,
  start: string | null,
  end: string | null,
): string | null {
  const parts: string[] = []
  if (place && place.trim()) parts.push(place.trim())
  const range = formatDateRange(start, end)
  if (range) parts.push(range)
  return parts.length > 0 ? parts.join(' · ') : null
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null
  if (start && end && start !== end) return `${start} ~ ${end}`
  return start ?? end
}

/**
 * 상대 시간 포맷 — "방금 전 / N분 전 / N시간 전 / N일 전 / N주 전 / YYYY-MM-DD".
 * Intl.RelativeTimeFormat 도 가능하나, 짧은 한국어 톤(우리 도메인 카피)에 맞춰 직접 작성.
 */
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
  // 한 달 넘으면 절대 날짜로
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
