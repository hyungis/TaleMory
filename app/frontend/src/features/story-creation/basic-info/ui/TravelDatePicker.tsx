import { useEffect, useMemo, useRef, useState } from 'react'
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

/**
 * 여행 일정 — 입력박스 + 달력 아이콘 트리거 → 클릭 시 팝오버 캘린더.
 *
 * 트리거(접힌 상태):
 *  - 다른 인풋들과 같은 톤(베이지 #e8ddb4 + 따뜻한 브라운 보더)으로 통일.
 *  - 좌측에 선택된 일정 요약(또는 placeholder), 우측에 달력 아이콘.
 *
 * 팝오버(펼친 상태):
 *  - 트리거 바로 아래 absolute 로 띄움 (z-20).
 *  - 6주 × 7요일 = 42칸 고정 그리드 + 월 네비게이션 + 초기화 버튼.
 *  - 외부 클릭 / Esc / 범위 선택 완료 시 자동 닫힘.
 *
 * 동작:
 *  - 첫 클릭 → 출발일 (팝오버는 열린 채 유지).
 *  - 두 번째 클릭 → 도착일 + 자동 닫힘.
 *  - 두 날짜 모두 선택된 상태에서 다시 클릭 → 새 출발일로 리셋.
 *  - 출발일과 같은 날 재클릭 → 단일 일정으로 끝 (열린 채 유지).
 */
export function TravelDatePicker({ startDate, endDate, onChange }: TravelDatePickerProps) {
  const today = useMemo(() => new Date(), [])
  const start = useMemo(() => fromIso(startDate), [startDate])
  const end = useMemo(() => fromIso(endDate), [endDate])

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  // 휠 이벤트 throttle 용 — 마지막 fire 시각.
  const lastWheelMsRef = useRef(0)

  // 표시 중인 월(1일 기준). 초기엔 startDate 가 있으면 그 월을, 없으면 오늘 월을.
  const [viewMonth, setViewMonth] = useState(() => {
    const ref = start ?? today
    return new Date(ref.getFullYear(), ref.getMonth(), 1)
  })

  /**
   * 외부 클릭 / Esc 로 팝오버 닫기.
   * isOpen 이 false 면 listener 부착 X (불필요한 글로벌 핸들러 회피).
   */
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

  /**
   * 휠 스크롤로 월 이동.
   * React 의 onWheel SyntheticEvent 는 passive 로 등록돼서 preventDefault 가 안 먹는다.
   * 따라서 ref + native addEventListener({ passive: false }) 로 직접 부착.
   *
   * 200ms throttle: 트랙패드 한 번 스와이프가 10+ 이벤트 발생시키는 것을 한 달 이동으로 묶음.
   * deltaY > 0 (아래로 스크롤) → 다음 달, < 0 (위로 스크롤) → 이전 달.
   */
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

  /**
   * 6주(42셀) 고정 그리드. 첫 주의 빈 칸은 이전 달 마지막 날들로,
   * 마지막 주의 빈 칸은 다음 달 시작 날들로 채워 회색 톤으로 표시.
   */
  const monthGrid = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const startWeekday = firstDay.getDay() // 0=Sun ~ 6=Sat
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
    const iso = toIso(day)

    // 새 사이클 시작
    if (!start || end) {
      onChange(iso, null)
      return
    }
    // start 만 있고 end 없음 → end 선택 중
    if (sameDay(day, start)) {
      onChange(iso, null)
      return
    }
    if (day < start) {
      onChange(iso, null)
      return
    }
    onChange(toIso(start), iso)
    setIsOpen(false) // 범위 완성 시 자동 닫기
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

  // 트리거에 표시할 요약 텍스트
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
    <div ref={containerRef} className="relative">
      {/* 트리거 — 다른 인풋과 동일 톤. 클릭 시 팝오버 토글. */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`w-full p-4 bg-[#e8ddb4] border-2 rounded-xl outline-none text-left text-lg text-black flex items-center justify-between gap-3 transition-colors ${
          isOpen
            ? 'border-[#2d5a27]'
            : 'border-[#8b7a52]/60 hover:border-[#2d5a27]/60'
        }`}
      >
        <span className={start || end ? 'text-black' : 'text-black/60'}>
          {triggerLabel}
        </span>
        <CalendarIcon className="w-5 h-5 text-[#2d5a27] shrink-0" />
      </button>

      {/* 팝오버 캘린더 */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="여행 일정 선택 — 휠 스크롤로 월 이동 가능"
          className="absolute top-full left-0 mt-2 z-20 w-full max-w-sm bg-[#f0e6c0] border-2 border-[#8b7a52]/60 rounded-xl p-3 shadow-[0_8px_24px_rgba(0,0,0,0.25)] select-none"
        >
          {/* 헤더: 이전 / 월 표시 / 다음 */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="이전 달"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-black hover:bg-[#8b7a52]/25 active:bg-[#8b7a52]/40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-base font-bold text-black">{monthLabel}</span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="다음 달"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-black hover:bg-[#8b7a52]/25 active:bg-[#8b7a52]/40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 요일 행 */}
          <div className="grid grid-cols-7 mb-1.5 text-center text-xs font-bold">
            {WEEKDAYS.map((w, i) => (
              <span
                key={w}
                className={
                  i === 0
                    ? 'text-[#8b3a2a]'
                    : i === 6
                      ? 'text-[#2d5a27]'
                      : 'text-black/70'
                }
              >
                {w}
              </span>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map(({ date, inMonth }) => {
              const isStart = !!start && sameDay(date, start)
              const isEnd = !!end && sameDay(date, end)
              const inRange = isInRange(date)
              const isToday = sameDay(date, today)

              const base =
                'aspect-square flex items-center justify-center rounded-md text-sm font-medium cursor-pointer transition-colors'
              let stateCls: string
              if (!inMonth) {
                stateCls = 'text-black/25 hover:bg-[#8b7a52]/15'
              } else if (isStart || isEnd) {
                stateCls =
                  'bg-[#2d5a27] text-[#f0e6c0] font-bold shadow-sm hover:bg-[#3d6f34]'
              } else if (inRange) {
                stateCls = 'bg-[#2d5a27]/25 text-black hover:bg-[#2d5a27]/40'
              } else {
                stateCls = 'text-black hover:bg-[#8b7a52]/30'
              }
              const todayCls =
                isToday && !(isStart || isEnd) ? 'ring-2 ring-[#2d5a27]/60' : ''

              return (
                <button
                  type="button"
                  key={toIso(date)}
                  onClick={() => handleDayClick(date)}
                  className={`${base} ${stateCls} ${todayCls}`}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          {/* 푸터: 초기화 + 닫기 */}
          <div className="mt-3 pt-2 border-t border-[#8b7a52]/30 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-[#8b3a2a] hover:text-[#a84a35] hover:underline disabled:opacity-30 disabled:cursor-not-allowed disabled:no-underline"
              disabled={!start && !end}
            >
              <RotateCcw className="w-3 h-3" />
              초기화
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-md bg-[#2d5a27] text-[#f0e6c0] hover:bg-[#3d6f34] transition-colors font-bold"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
