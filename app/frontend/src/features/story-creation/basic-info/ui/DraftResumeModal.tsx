import { AlertTriangle, Plus } from 'lucide-react'
import type { MainCharacterPayload, StoryDraftResponse } from '../api/types'

interface DraftResumeModalProps {
  /** 서버에서 받아온 진행 중 DRAFT. null 이면 모달 자체가 렌더되지 않아야 함. */
  draft: StoryDraftResponse
  /** 기존 DRAFT 를 soft delete 하고 빈 상태로 새 동화 시작 (확인 클릭). */
  onStartNew: () => void
  /** ESC / overlay 클릭 / 취소 — 모달만 닫고 아무 동작도 안 함. draft 는 보존. */
  onClose: () => void
  /** "새로 시작" 진행 중 (DELETE 중) 버튼 비활성화. */
  isSubmitting?: boolean
}

/**
 * "새 동화책 시작 — 진행 중 동화 폐기 확인" 모달.
 *
 * 이전엔 "이어서 작성 / 새로 시작" 양자택일이었는데, "이어서 작성" 경로는 책장 상단의
 * `<DraftResumeBanner />` 가 담당하게 되어 모달은 "discard + 새로 시작" 확인 한 가지로
 * 단순화되었다.
 *
 * BookstoreScene 에서 "새 동화책 만들기" 클릭 → 이미 fetch 된 draft 가 있으면 이 모달이 떠서
 * 사용자에게 폐기 동의를 받음. 사용자가 확인하면 onStartNew 가 DELETE + navigate 수행.
 */
export function DraftResumeModal({
  draft,
  onStartNew,
  onClose,
  isSubmitting = false,
}: DraftResumeModalProps) {
  const startedAgoLabel = formatRelativeTime(draft.createdAt)
  const dateRangeLabel = formatDateRange(draft.travelStartDate, draft.travelEndDate)
  const childrenLabel = formatChildren(draft.mainCharacterJson)
  const difficultyLabel = formatDifficulty(draft.difficulty)

  return (
    <div
      className="fixed inset-0 z-[6000] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-[overlayFadeIn_0.18s_ease-out]"
      onClick={() => !isSubmitting && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[#F4E4BC] border-2 border-[#9A7548]/40 rounded-3xl shadow-[0_20px_60px_rgba(107,74,40,0.4)] max-w-sm w-full p-6 sm:p-7"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="shrink-0 w-11 h-11 bg-[#D8857C] rounded-full flex items-center justify-center border-2 border-[#E2BFB9]">
            <AlertTriangle className="w-5 h-5 text-[#3E2A18]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg text-[#3E2A18] font-bold mb-1">새로 시작하시겠어요?</h2>
            <p className="text-[#6B4A28] text-sm leading-relaxed">
              진행 중인 동화책이 사라지고 복구할 수 없어요.
            </p>
          </div>
        </div>

        {/* 사라질 draft 정보 — 사용자가 무엇을 잃는지 한 번 더 인지하도록 */}
        <div className="bg-[#E9DBBE] border border-[#9A7548]/30 rounded-xl p-3 mb-5 space-y-1.5">
          <DraftRow label="아이" value={childrenLabel} />
          <DraftRow label="여행 장소" value={draft.travelPlace ?? '(미입력)'} />
          <DraftRow label="여행 일정" value={dateRangeLabel} />
          <DraftRow label="난이도" value={difficultyLabel} />
          <DraftRow label="시작" value={startedAgoLabel} />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-[#E9DBBE] text-[#3E2A18] px-4 py-2.5 rounded-full border-2 border-[#9A7548]/40 hover:bg-[#D9BE82] transition-colors font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onStartNew}
            disabled={isSubmitting}
            className="flex-1 bg-[#D8857C] text-[#3E2A18] px-4 py-2.5 rounded-full border-2 border-[#E2BFB9] shadow-[0_2px_0_#B0473F] hover:translate-y-0.5 hover:shadow-[0_1px_0_#B0473F] hover:bg-[#E2BFB9] transition-all font-bold flex items-center justify-center gap-1.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <Plus className="w-4 h-4" /> {isSubmitting ? '정리 중…' : '네, 새로 시작'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DraftRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-[#6B4A28] font-semibold shrink-0">{label}</span>
      <span className="text-[#3E2A18] font-bold text-right truncate">{value}</span>
    </div>
  )
}

/**
 * 상대 시간 포맷 — "방금 전 / N분 전 / N시간 전 / N일 전 / N주 전 / YYYY-MM-DD".
 * 배너와 같은 톤으로 통일 (사용자가 두 곳에서 같은 표기 인지).
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
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '(미입력)'
  if (start && end && start !== end) return `${start} ~ ${end}`
  return (start ?? end) as string
}

/**
 * mainCharacterJson 파싱 후 "이름 (N세), 이름 (N세)" 표기. 비어있으면 '(미입력)'.
 */
function formatChildren(json: string): string {
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return '(미입력)'
    const labels = parsed
      .map(c => {
        const partial = c as Partial<MainCharacterPayload>
        const name = partial.name?.trim()
        if (!name) return null
        const age = partial.age
        return typeof age === 'number' ? `${name} (${age}세)` : name
      })
      .filter((s): s is string => Boolean(s))
    return labels.length > 0 ? labels.join(', ') : '(미입력)'
  } catch {
    return '(미입력)'
  }
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
