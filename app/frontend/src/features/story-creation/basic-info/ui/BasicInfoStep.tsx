import { User } from 'lucide-react'
import type { StoryProject } from '../../model/types'
import { StepHeader } from '../../ui/StepHeader'
import { NextButton } from '../../ui/NextButton'
import { LevelPicker } from './LevelPicker'
import { ChildrenList } from './ChildrenList'

interface BasicInfoStepProps {
  data: StoryProject['step1']
  onUpdate: <K extends keyof StoryProject['step1']>(key: K, value: StoryProject['step1'][K]) => void
  onChildUpdate: (index: number, patch: Partial<StoryProject['step1']['children'][number]>) => void
  onChildAdd: () => void
  onChildRemove: (index: number) => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 01 — 아이 정보 + 함께 여행한 사람 + 난이도 + 여행 일정 + 여행 장소.
 *
 * 현재 (Task 4a) 는 캘린더 위젯 대신 `<input type="date">` 2개로 시작/종료일 선택.
 * 풀 캘린더 그리드는 후속 폴리시 커밋에서 이관 예정.
 */
export function BasicInfoStep({
  data,
  onUpdate,
  onChildUpdate,
  onChildAdd,
  onChildRemove,
  onBack,
  onNext,
}: BasicInfoStepProps) {
  const firstDate = data.travelDates[0] ?? ''
  const lastDate = data.travelDates[data.travelDates.length - 1] ?? ''

  const handleDateRangeChange = (side: 'start' | 'end', value: string) => {
    const start = side === 'start' ? value : firstDate
    const end = side === 'end' ? value : lastDate
    const next: string[] = []
    if (start) next.push(start)
    if (end && end !== start) next.push(end)
    onUpdate('travelDates', next)
  }

  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={1} stepTitle="동화책 주인공 정보" onBack={onBack} />

      <div className="bookshelf-scroll">
        <main className="py-12 px-6 bookshelf-fade-in">
          <div className="max-w-3xl mx-auto bg-[#f0e6c0] p-8 md:p-12 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-2 border-[#2a1b12]">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <User className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl text-[#2d5a27] font-bold">여행 장소와 일정을 입력해주세요</h2>
              <p className="text-[#8b7a52] mt-2">동화책의 주인공이 될 아이의 정보를 알려주세요.</p>
            </div>

            <div className="space-y-6">
              <ChildrenList
                children={data.children}
                onChildUpdate={onChildUpdate}
                onChildAdd={onChildAdd}
                onChildRemove={onChildRemove}
              />

              <div>
                <label className="block text-[#2d5a27] text-lg mb-2 font-bold">함께 여행한 사람</label>
                <input
                  type="text"
                  placeholder="예: 엄마, 아빠, 할머니, 동생"
                  value={data.companions}
                  onChange={e => onUpdate('companions', e.target.value)}
                  className="w-full p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-xl text-[#2d5a27] placeholder-[#8b7a52]/60"
                />
              </div>

              <LevelPicker value={data.level} onChange={v => onUpdate('level', v)} />

              <div>
                <label className="block text-[#2d5a27] text-lg mb-2 font-bold">여행 일정</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={firstDate}
                    onChange={e => handleDateRangeChange('start', e.target.value)}
                    className="w-full p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-lg text-[#2d5a27]"
                  />
                  <input
                    type="date"
                    value={lastDate}
                    onChange={e => handleDateRangeChange('end', e.target.value)}
                    className="w-full p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-lg text-[#2d5a27]"
                  />
                </div>
                <p className="text-xs text-[#8b7a52]/80 mt-2">
                  TODO(S14P31S210-76, Task 폴리시): 풀 캘린더 그리드로 교체 예정 (원본은 월간 달력 + 다중 날짜 선택).
                </p>
              </div>

              <div>
                <label className="block text-[#2d5a27] text-lg mb-2 font-bold">여행 장소</label>
                <input
                  type="text"
                  placeholder="예: 제주도, 부산 해운대, 경주"
                  value={data.location}
                  onChange={e => onUpdate('location', e.target.value)}
                  className="w-full p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-xl text-[#2d5a27] placeholder-[#8b7a52]/60"
                />
              </div>
            </div>

            <NextButton onClick={onNext}>사진 선택하러 가기</NextButton>
          </div>
        </main>
      </div>
    </div>
  )
}
