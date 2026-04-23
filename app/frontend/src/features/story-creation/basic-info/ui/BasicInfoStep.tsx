import { useCallback, useState } from 'react'
import { AlertCircle, User } from 'lucide-react'
import type { StoryChild, StoryProject } from '../../model/types'
import { StepHeader } from '../../ui/StepHeader'
import { NextButton } from '../../ui/NextButton'
import { LevelPicker } from './LevelPicker'
import { ChildrenList } from './ChildrenList'
import type { PersonResponse } from '../api/types'
import { usePersonsQuery } from '../model/usePersonsQuery'
import { usePersonPost } from '../model/usePersonPost'
import { useStoryPost } from '../model/useStoryPost'
import {
  ageToBirthDate,
  apiGenderToStoryChild,
  birthDateToAge,
  levelToDifficulty,
  storyChildGenderToApi,
} from '../lib/mappers'

interface BasicInfoStepProps {
  data: StoryProject['step1']
  onUpdate: <K extends keyof StoryProject['step1']>(key: K, value: StoryProject['step1'][K]) => void
  onChildUpdate: (index: number, patch: Partial<StoryChild>) => void
  onChildAdd: () => void
  /** 드롭다운 "저장된 아이 불러오기" 선택 시 pre-filled row 로 append. */
  onChildAppend: (child: StoryChild) => void
  onChildRemove: (index: number) => void
  onBack: () => void
  /** POST /api/stories 성공 시 storyId 를 상위로 전달. 상위는 flow.setStoryId + handleNext 수행. */
  onStoryCreated: (storyId: number) => void
}

/**
 * STEP 01 — 아이 정보 + 함께 여행한 사람 + 난이도 + 여행 일정 + 여행 장소.
 *
 * API 연동 (S14P31S210-51):
 *  1. 화면 진입 시 `GET /api/persons?role=CHILD` → 드롭다운 목록
 *  2. "사진 선택하러 가기" 클릭 시
 *     a. `personId` 없는 신규 아이만 `POST /api/persons` 로 먼저 등록
 *     b. 확정된 mainCharacters 배열을 포함해 `POST /api/stories` 호출
 *     c. 반환된 storyId 를 상위에 전달 → 상위가 flow.setStoryId + step 2 이동
 */
export function BasicInfoStep({
  data,
  onUpdate,
  onChildUpdate,
  onChildAdd,
  onChildAppend,
  onChildRemove,
  onBack,
  onStoryCreated,
}: BasicInfoStepProps) {
  const firstDate = data.travelDates[0] ?? ''
  const lastDate = data.travelDates[data.travelDates.length - 1] ?? ''

  const personsQuery = usePersonsQuery('CHILD')
  const personPost = usePersonPost()
  const storyPost = useStoryPost()

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleDateRangeChange = (side: 'start' | 'end', value: string) => {
    const start = side === 'start' ? value : firstDate
    const end = side === 'end' ? value : lastDate
    const next: string[] = []
    if (start) next.push(start)
    if (end && end !== start) next.push(end)
    onUpdate('travelDates', next)
  }

  /** 드롭다운에서 기존 person 선택 시 → StoryChild 로 변환해 append. */
  const handleLoadPerson = useCallback(
    (person: PersonResponse) => {
      onChildAppend({
        name: person.name,
        gender: apiGenderToStoryChild(person.gender),
        age: birthDateToAge(person.birthDate),
        personId: person.id,
      })
    },
    [onChildAppend],
  )

  /**
   * "사진 선택하러 가기" 클릭 핸들러.
   * - 입력된 아이 중 이름/나이 모두 채워진 행만 유효. 그런 행이 0개면 에러.
   * - 신규 아이(personId 없음)는 POST /api/persons 로 먼저 등록.
   * - 확정된 mainCharacters 로 POST /api/stories → storyId 상위 전달.
   */
  const handleNext = useCallback(async () => {
    setSubmitError(null)

    const validChildren = data.children.filter(c => c.name.trim() && c.age.trim())
    if (validChildren.length === 0) {
      setSubmitError('아이 정보를 최소 한 명 이상 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      // 1) 신규 아이만 저장
      const resolved: StoryChild[] = []
      for (const child of validChildren) {
        if (child.personId) {
          resolved.push(child)
          continue
        }
        const created = await personPost.mutateAsync({
          name: child.name.trim(),
          birthDate: ageToBirthDate(child.age),
          gender: storyChildGenderToApi(child.gender),
          role: 'CHILD',
        })
        resolved.push({ ...child, personId: created.id })
      }

      // 2) 스토리 row 생성 — 서버 JSON 컬럼에 그대로 저장되는 형태로 직렬화
      const mainCharactersPayload = resolved.map(c => ({
        personId: c.personId,
        name: c.name.trim(),
        age: Number.parseInt(c.age, 10) || 0,
        gender: storyChildGenderToApi(c.gender),
      }))
      const response = await storyPost.mutateAsync({
        title: null,
        difficulty: levelToDifficulty(data.level),
        companionsJson: JSON.stringify(data.companions ?? ''),
        mainCharacterJson: JSON.stringify(mainCharactersPayload),
        travelPlace: data.location.trim() || null,
        travelStartDate: firstDate || null,
        travelEndDate: lastDate || null,
      })

      onStoryCreated(response.storyId)
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [data, firstDate, lastDate, onStoryCreated, personPost, storyPost])

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
                existingPersons={personsQuery.data}
                onLoadPerson={handleLoadPerson}
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

            {submitError && (
              <div className="mt-6 bg-[#8b3a2a]/15 border border-[#8b3a2a]/40 text-[#8b3a2a] text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <NextButton onClick={handleNext} disabled={isSubmitting}>
              {isSubmitting ? '저장 중…' : '사진 선택하러 가기'}
            </NextButton>
          </div>
        </main>
      </div>
    </div>
  )
}
