import { AlertTriangle, BookOpen, Plus } from 'lucide-react'
import type { StoryDraftResponse } from '../api/types'

interface DraftResumeModalProps {
  /** 서버에서 받아온 진행 중 DRAFT. null 이면 모달 자체가 렌더되지 않아야 함. */
  draft: StoryDraftResponse
  /** 기존 DRAFT 에 이어서 작성 — storyId 보존 + 필드 rehydrate 후 /creation 진입. */
  onResume: () => void
  /** 기존 DRAFT 를 soft delete 하고 빈 상태로 새 동화 시작. */
  onStartNew: () => void
  /** ESC / overlay 클릭 등으로 모달만 닫고 아무 동작도 안 함. */
  onClose: () => void
  /** "새로 시작" 진행 중 (DELETE 중) 버튼 비활성화. */
  isSubmitting?: boolean
}

/**
 * "진행 중인 동화가 있어요" 모달.
 *
 * BookstoreScene 에서 "새 동화책 만들기" 클릭 → GET /api/stories/draft 조회 후
 * 결과가 있을 때만 렌더한다. 두 가지 선택지를 제공:
 *  1. 이어서 작성하기 — rehydrate 해서 그대로 진입 (PATCH 로 서버 반영됨)
 *  2. 새로 시작하기  — DELETE 로 기존 DRAFT soft delete 후 빈 상태로 진입
 */
export function DraftResumeModal({
  draft,
  onResume,
  onStartNew,
  onClose,
  isSubmitting = false,
}: DraftResumeModalProps) {
  const createdAtLabel = formatCreatedAt(draft.createdAt)
  const dateRangeLabel = formatDateRange(draft.travelStartDate, draft.travelEndDate)

  return (
    <div
      className="library-modal-overlay"
      onClick={() => !isSubmitting && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bookshelf-modal step-forest-modal max-w-lg w-[90%] mx-auto my-auto"
        style={{ height: 'auto', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="bookshelf-scroll">
          <main className="py-10 px-6 bookshelf-fade-in">
            <div className="bg-[#f0e6c0] p-8 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-2 border-[#2a1b12]">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                  <BookOpen className="w-8 h-8 text-black" />
                </div>
                <h2 className="text-2xl text-black font-bold">진행 중인 동화가 있어요</h2>
                <p className="text-black mt-2 text-sm">
                  이어서 작성하거나, 새로 시작할 수 있습니다.
                </p>
              </div>

              <div className="bg-[#e8ddb4] border-2 border-[#8b7a52]/40 rounded-2xl p-5 mb-6 space-y-2">
                <DraftRow label="여행 장소" value={draft.travelPlace ?? '(미입력)'} />
                <DraftRow label="여행 일정" value={dateRangeLabel} />
                <DraftRow label="작성 시작" value={createdAtLabel} />
              </div>

              <div className="bg-[#8b3a2a]/10 border border-[#8b3a2a]/40 text-black text-xs px-4 py-3 rounded-xl flex items-start gap-2 mb-6">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-[2px]" />
                <span>
                  <b>"새로 시작하기"</b> 선택 시 위 초안은 삭제되며 복구할 수 없습니다.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onResume}
                  disabled={isSubmitting}
                  className="flex-1 bg-[#2d5a27] text-black px-6 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14] hover:bg-[#3d6f34] transition-all font-bold flex items-center justify-center gap-2 text-base disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  <BookOpen className="w-5 h-5" /> 이어서 작성하기
                </button>
                <button
                  type="button"
                  onClick={onStartNew}
                  disabled={isSubmitting}
                  className="flex-1 bg-[#8b3a2a] text-black px-6 py-4 rounded-full border border-[#a84a35]/40 shadow-[0_4px_0_#5b2418] hover:translate-y-1 hover:shadow-[0_2px_0_#5b2418] hover:bg-[#a84a35] transition-all font-bold flex items-center justify-center gap-2 text-base disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  <Plus className="w-5 h-5" /> {isSubmitting ? '정리 중…' : '새로 시작하기'}
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function DraftRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-black font-semibold shrink-0">{label}</span>
      <span className="text-black font-bold text-right truncate">{value}</span>
    </div>
  )
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '(미입력)'
  if (start && end && start !== end) return `${start} ~ ${end}`
  return (start ?? end) as string
}
