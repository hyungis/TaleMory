import { useMemo, useState } from 'react'
import { MessageCircle, MessageSquareText } from 'lucide-react'
import type { StoryboardSentenceItem } from '../api/types'

interface WebtoonSentenceEditorProps {
  /** 현재 page 의 sentences[] (BE 응답 그대로). 옛 row 호환 위해 nullable 허용. */
  initialSentences: StoryboardSentenceItem[] | null | undefined
  /**
   * 저장 클릭 시 호출 — `이름: 본문\n` 형식으로 합쳐진 koreanText 반환.
   * 부모가 그대로 PATCH /storyboard/pages/{n} body 의 koreanText 로 전달.
   */
  onSave: (combinedKoreanText: string) => void
  /** 취소 — 편집 모드 종료 (변경사항 폐기). */
  onCancel: () => void
  /** 저장 중 (mutation pending). */
  isSubmitting: boolean
  /** 외부 잠금 (번역 진행 중 등). */
  disabled: boolean
}

/**
 * WEBTOON 모드 페이지의 한글 본문을 sentence 단위 row 로 편집한다.
 *
 * 설계 의도 (가장 보수적):
 *  - **AI 가 정한 sentence 갯수/구조 100% 불변** — 사용자는 본문 input 만 수정 가능.
 *  - 화자 chip 잠금 (speakerKey 변경 불가) — AI/charactersInScene 진실 보존.
 *  - row 추가/삭제 모두 불가 — 매칭 어긋남, 이미지 불일치 등 위험 0.
 *  - 새 화자 또는 라인 추가가 정말 필요하면 페이지 재생성 흐름으로 가야 함.
 *
 * 결과적으로:
 *  - sentence 갯수 보존 → 번역 결과 sentenceOrder 100% 매칭 → null 메타 발생 X
 *  - speakerKey 보존 → TTS / scene 분리 / 향후 webtoon 컷 배치 다 OK
 *  - 사용자 의도 명확화 — "본문 다듬기" 만 가능
 *
 * 저장 동작:
 *  - 각 row 를 `이름: 본문` (DIALOGUE) 또는 `본문` (NARRATION) 으로 변환 후 줄바꿈 join
 *  - 합쳐진 koreanText 를 onSave 로 부모에 전달 (기존 PATCH API 그대로 호출)
 *  - BE 의 라인 파서가 다시 sentences[] 로 분해 → 메타 그대로 보존
 */
export function WebtoonSentenceEditor({
  initialSentences,
  onSave,
  onCancel,
  isSubmitting,
  disabled,
}: WebtoonSentenceEditorProps) {
  const initialRows = useMemo(() => toRows(initialSentences), [initialSentences])
  const [rows, setRows] = useState<EditorRow[]>(initialRows)

  const updateRow = (idx: number, koreanText: string) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, koreanText } : r)))
  }

  const hasEmptyRow = rows.some(r => !r.koreanText.trim())

  const handleSave = () => {
    if (hasEmptyRow) return
    const combined = rowsToKoreanText(rows).trim()
    if (combined.length === 0) return
    onSave(combined)
  }

  const isReadOnly = disabled || isSubmitting

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2">
        {rows.map((row, idx) => (
          <SentenceRow
            key={idx}
            row={row}
            disabled={isReadOnly}
            isEmpty={!row.koreanText.trim()}
            onChange={text => updateRow(idx, text)}
          />
        ))}
        {rows.length === 0 && (
          <p className="text-[#9A7548]/70 text-sm italic px-2">
            편집 가능한 문장이 없어요.
          </p>
        )}
      </div>

      {/* 빈 row 안내 — 빈 본문이 하나라도 있으면 저장 막힘. */}
      {hasEmptyRow && (
        <p className="text-sm text-[#B0473F] font-bold inline-flex items-start gap-1 px-1">
          <span aria-hidden="true">⚠️</span>
          <span>비어있는 문장이 있어요. 본문을 채워주세요. (문장은 삭제할 수 없어요.)</span>
        </p>
      )}

      {/* 저장/취소 */}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-lg border border-[#9A7548]/35 bg-[#F4E4BC] px-3 py-1.5 text-sm font-bold text-[#6B4A28] transition-colors hover:bg-[#E9DBBE] disabled:cursor-not-allowed disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting || disabled || rows.length === 0 || hasEmptyRow}
          className="inline-flex items-center justify-center rounded-lg border border-[#3F6B2E]/35 bg-[#3F6B2E] px-3 py-1.5 text-sm font-bold text-[#FFF8E0] transition-colors hover:bg-[#4F7B3E] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? '저장 중…' : '확인'}
        </button>
      </div>
    </div>
  )
}

interface EditorRow {
  /** WEBTOON sentence type. UI 에선 NARRATION/DIALOGUE 두 종류. */
  type: 'NARRATION' | 'DIALOGUE'
  /** DIALOGUE 면 캐릭터 키, NARRATION 이면 "narrator". */
  speakerKey: string
  /** 사용자가 편집하는 본문 (prefix 제거된 raw 텍스트). */
  koreanText: string
}

/** sentences[] (BE 응답) → EditorRow[] (UI 상태) 변환. */
function toRows(sentences: StoryboardSentenceItem[] | null | undefined): EditorRow[] {
  if (!sentences || sentences.length === 0) return []
  return sentences.map(s => {
    const isDialogue = s.type === 'DIALOGUE' && !!s.speakerKey && s.speakerKey !== 'narrator'
    return {
      type: isDialogue ? 'DIALOGUE' : 'NARRATION',
      speakerKey: isDialogue ? (s.speakerKey as string) : 'narrator',
      koreanText: s.koreanText ?? '',
    }
  })
}

/** EditorRow[] → 저장 시 BE 에 보낼 koreanText 합본. */
function rowsToKoreanText(rows: EditorRow[]): string {
  return rows
    .map(r => {
      const text = r.koreanText.trim()
      if (!text) return ''
      if (r.type === 'DIALOGUE' && r.speakerKey && r.speakerKey !== 'narrator') {
        return `${r.speakerKey}: ${text}`
      }
      return text
    })
    .filter(Boolean)
    .join('\n')
}

interface SentenceRowProps {
  row: EditorRow
  disabled: boolean
  /** 본문이 비어있는 row — 시각적으로 빨간 border + 배경으로 강조해 사용자 인지 유도. */
  isEmpty: boolean
  onChange: (text: string) => void
}

/**
 * 한 sentence row — 화자 chip(read-only) + 본문 input.
 *
 * 의도된 제약:
 *  - 삭제 버튼 없음 — sentence 갯수 임의 감소 방지.
 *  - 화자 chip 잠금 — speakerKey 변경 불가, 시스템 truth 보존.
 *  - 본문 input 만 자유 편집 가능 — 단, 빈 본문은 저장 차단 (상위에서 [확인] disable).
 */
function SentenceRow({ row, disabled, isEmpty, onChange }: SentenceRowProps) {
  const isDialogue = row.type === 'DIALOGUE'
  const textareaClass = isEmpty
    ? 'flex-1 min-h-[2.5rem] bg-[#FCE9E5] text-[#3E2A18] text-base leading-relaxed font-medium focus:outline-none resize-none placeholder-[#B0473F]/60 border-2 border-[#B0473F] rounded-lg p-2 disabled:cursor-not-allowed disabled:opacity-60'
    : 'flex-1 min-h-[2.5rem] bg-[#FFF8E0] text-[#3E2A18] text-base leading-relaxed font-medium focus:outline-none resize-none placeholder-[#9A7548]/60 border border-[#9A7548]/30 rounded-lg p-2 disabled:cursor-not-allowed disabled:opacity-60'
  return (
    <div className="flex items-start gap-2">
      <span
        className={
          isDialogue
            ? 'shrink-0 inline-flex items-center gap-1 bg-[#3F6B2E] text-[#FFF8E0] px-2.5 py-1 rounded-full text-sm font-bold border border-[#3F6B2E]/40 whitespace-nowrap mt-0.5'
            : 'shrink-0 inline-flex items-center gap-1 bg-[#E9DBBE] text-[#6B4A28] px-2.5 py-1 rounded-full text-sm font-bold border border-[#9A7548]/40 whitespace-nowrap mt-0.5'
        }
        title={isDialogue ? `${row.speakerKey} 의 대사 (잠금)` : '나레이션 (잠금)'}
      >
        {isDialogue ? (
          <>
            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
            {row.speakerKey}
          </>
        ) : (
          <>
            <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
            나레이션
          </>
        )}
      </span>
      <textarea
        value={row.koreanText}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        className={textareaClass}
        placeholder={isDialogue ? '대사 본문' : '나레이션 본문'}
      />
    </div>
  )
}
