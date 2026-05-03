import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react'

interface TravelDatePickerProps {
  /** ISO 'YYYY-MM-DD' 또는 null. */
  startDate: string | null
  endDate: string | null
  /**
   * 출발/도착 변경 알림. (start, end) 두 값이 동시에 갱신될 수도, 한 쪽만 갱신될 수도 있다.
   * end 가 null 이면 단일 날짜(혹은 출발만 선택, 도착 미정) 상태.
   */
  onChange: (start: string | null, end: string | null) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_NAMES = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fromIso(s: string | null): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** start-of-day Date 를 만든다 (시/분/초 0). 미래 비교용. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * 여행 일정 — paper-craft 톤 트리거 + 팝오버 캘린더.
 * 오늘 날짜 이후는 선택 불가 (여행은 이미 다녀온 일정이므로).
 *
 * 트리거: cr-input 톤 (cream + caramel border + sage focus) + 우측 달력 아이콘.
 * 팝오버: cream gradient + caramel-deep 입체 그림자 + sage 선택/범위 표시.
 *
 * 동작:
 *  - 첫 클릭 → 출발일.
 *  - 두 번째 클릭 → 도착일 + 자동 닫힘.
 *  - 두 날짜 모두 선택된 상태에서 다시 클릭 → 새 출발일로 리셋.
 *  - 출발일과 같은 날 재클릭 → 단일 일정으로 끝.
 *  - 오늘 이후 날짜 → 비활성 (클릭 무시 + opacity 30%).
 */
export function TravelDatePicker({ startDate, endDate, onChange }: TravelDatePickerProps) {
  const today = useMemo(() => startOfDay(new Date()), [])
  const start = useMemo(() => fromIso(startDate), [startDate])
  const end = useMemo(() => fromIso(endDate), [endDate])

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const lastWheelMsRef = useRef(0)

  const [viewMonth, setViewMonth] = useState(() => {
    const ref = start ?? today
    return new Date(ref.getFullYear(), ref.getMonth(), 1)
  })

  useEffect(() => {
    if (!isOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const popover = popoverRef.current
    if (!popover) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = Date.now()
      if (now - lastWheelMsRef.current < 200) return
      lastWheelMsRef.current = now

      const delta = e.deltaY
      if (delta === 0) return
      setViewMonth(prev =>
        new Date(prev.getFullYear(), prev.getMonth() + (delta > 0 ? 1 : -1), 1),
      )
    }

    popover.addEventListener('wheel', onWheel, { passive: false })
    return () => popover.removeEventListener('wheel', onWheel)
  }, [isOpen])

  const monthGrid = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const startWeekday = firstDay.getDay()
    const cells: { date: Date; inMonth: boolean }[] = []

    for (let i = startWeekday - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month, -i), inMonth: false })
    }
    const lastDate = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= lastDate; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true })
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date
      cells.push({
        date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
        inMonth: false,
      })
    }
    return cells
  }, [viewMonth])

  const handleDayClick = (day: Date) => {
    // 오늘 이후는 선택 불가 (여행은 이미 다녀온 일정).
    if (day > today) return

    const iso = toIso(day)

    if (!start || end) {
      onChange(iso, null)
      return
    }
    if (sameDay(day, start)) {
      onChange(iso, null)
      return
    }
    if (day < start) {
      onChange(iso, null)
      return
    }
    onChange(toIso(start), iso)
    setIsOpen(false)
  }

  const handleReset = () => onChange(null, null)
  const handlePrevMonth = () =>
    setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  const handleNextMonth = () =>
    setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))

  const isInRange = (day: Date) => {
    if (!start || !end) return false
    return day >= start && day <= end
  }

  const monthLabel = `${viewMonth.getFullYear()}년 ${MONTH_NAMES[viewMonth.getMonth()]}`

  const triggerLabel = (() => {
    if (start && end) {
      const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
      return `${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getMonth() + 1}월 ${end.getDate()}일 (${days}일)`
    }
    if (start) {
      return `${start.getMonth() + 1}월 ${start.getDate()}일 — 도착일 선택`
    }
    return '여행 일정을 선택해주세요'
  })()

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* 트리거 — cr-input 톤. */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="cr-input"
        style={{
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          cursor: 'pointer',
          borderColor: isOpen ? 'var(--cr-sage)' : 'var(--cr-caramel)',
          boxShadow: isOpen ? '0 0 0 3px rgba(122, 153, 104, 0.18)' : 'none',
        }}
      >
        <span
          style={{
            color: start || end ? 'var(--cr-ink)' : '#b29d72',
            fontStyle: start || end ? 'normal' : 'italic',
          }}
        >
          {triggerLabel}
        </span>
        <CalendarIcon className="w-5 h-5" style={{ color: 'var(--cr-caramel-deep)', flexShrink: 0 }} />
      </button>

      {/* 팝오버 캘린더 */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="여행 일정 선택 — 휠 스크롤로 월 이동 가능"
          style={POPOVER_STYLE}
        >
          {/* 헤더: 이전 / 월 / 다음 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="이전 달"
              style={NAV_BTN_STYLE}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span style={{ fontFamily: 'var(--cr-font-serif)', fontWeight: 800, fontSize: 17, color: 'var(--cr-ink)' }}>
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="다음 달"
              style={NAV_BTN_STYLE}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 요일 행 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              marginBottom: 6,
              fontFamily: 'var(--cr-font-gaegu)',
              fontWeight: 700,
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {WEEKDAYS.map((w, i) => (
              <span
                key={w}
                style={{
                  color: i === 0 ? 'var(--cr-rust)' : i === 6 ? 'var(--cr-sage-deep)' : 'var(--cr-ink-soft)',
                }}
              >
                {w}
              </span>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {monthGrid.map(({ date, inMonth }) => {
              const isStart = !!start && sameDay(date, start)
              const isEnd = !!end && sameDay(date, end)
              const inRange = isInRange(date)
              const isToday = sameDay(date, today)
              const isFuture = date > today

              return (
                <button
                  type="button"
                  key={toIso(date)}
                  onClick={() => handleDayClick(date)}
                  disabled={isFuture}
                  style={getDayCellStyle({ inMonth, isStart, isEnd, inRange, isToday, isFuture })}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          {/* 푸터: 초기화 + 닫기 */}
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1.5px dashed rgba(163, 117, 72, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <button
              type="button"
              onClick={handleReset}
              disabled={!start && !end}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--cr-rust)',
                fontFamily: 'var(--cr-font-gaegu)',
                fontSize: 13,
                fontWeight: 700,
                cursor: !start && !end ? 'not-allowed' : 'pointer',
                opacity: !start && !end ? 0.4 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: 0,
              }}
            >
              <RotateCcw className="w-3 h-3" />
              초기화
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'var(--cr-sage)',
                color: '#fdf6dc',
                border: '2px solid var(--cr-sage-deep)',
                borderRadius: 999,
                padding: '5px 16px',
                fontFamily: 'var(--cr-font-gaegu)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 0 var(--cr-sage-deep)',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================================
 * 인라인 스타일
 * ========================================================================= */

const POPOVER_STYLE: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: 0,
  right: 0,
  zIndex: 30,
  maxWidth: 360,
  background: 'linear-gradient(135deg, #fbf2da 0%, #f5e6bd 100%)',
  border: '2px solid var(--cr-caramel-deep)',
  borderRadius: 16,
  padding: 14,
  boxShadow: '0 3px 0 var(--cr-caramel-deep), 0 12px 28px rgba(140, 100, 60, 0.28)',
  userSelect: 'none',
}

const NAV_BTN_STYLE: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  background: 'transparent',
  border: 0,
  color: 'var(--cr-ink)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.12s ease',
}

function getDayCellStyle(opts: {
  inMonth: boolean
  isStart: boolean
  isEnd: boolean
  inRange: boolean
  isToday: boolean
  isFuture: boolean
}): CSSProperties {
  const { inMonth, isStart, isEnd, inRange, isToday, isFuture } = opts

  const base: CSSProperties = {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    border: 'none',
    fontFamily: 'var(--cr-font-gaegu)',
    fontSize: 14,
    fontWeight: 600,
    cursor: isFuture ? 'not-allowed' : 'pointer',
    transition: 'background 0.12s ease, color 0.12s ease',
    background: 'transparent',
    color: 'var(--cr-ink)',
  }

  if (isFuture) {
    return {
      ...base,
      color: 'rgba(74, 59, 42, 0.25)',
      background: 'transparent',
      cursor: 'not-allowed',
    }
  }

  if (!inMonth) {
    return {
      ...base,
      color: 'rgba(74, 59, 42, 0.3)',
    }
  }

  if (isStart || isEnd) {
    return {
      ...base,
      background: 'var(--cr-sage-darker)',
      color: '#fdf6dc',
      fontWeight: 800,
      boxShadow: '0 2px 0 #2a3f1f',
    }
  }

  if (inRange) {
    return {
      ...base,
      background: 'rgba(122, 153, 104, 0.28)',
      color: 'var(--cr-ink)',
    }
  }

  if (isToday) {
    return {
      ...base,
      boxShadow: 'inset 0 0 0 2px rgba(95, 125, 80, 0.55)',
      color: 'var(--cr-sage-deep)',
      fontWeight: 800,
    }
  }

  return base
}
