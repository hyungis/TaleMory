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
import { useStoryUpdate } from '../model/useStoryUpdate'
import {
  ageToBirthDate,
  apiGenderToStoryChild,
  birthDateToAge,
  levelToDifficulty,
  storyChildGenderToApi,
} from '../lib/mappers'

interface BasicInfoStepProps {
  data: StoryProject['step1']
  /**
   * 이미 생성된 story 의 id. 없으면 null.
   * 값이 있으면 재클릭 시 POST /api/stories 스킵하고 그대로 다음 step 으로 전환
   * (중복 DRAFT 레코드 생성 방지).
   */
  storyId: number | null
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
 *        → 반환된 id 를 flow.step1.children[idx].personId 에 써 넣어 재클릭 시 중복 등록 방지.
 *     b. `storyId` 가 아직 없으면 `POST /api/stories` 로 생성 → 반환 storyId 상위 전달.
 *     c. 이미 있으면 `PATCH /api/stories/{id}` 로 step 1 필드 서버 반영 (중복 DRAFT 방지 + 수정 내용 저장).
 */
export function BasicInfoStep({
  data,
  storyId,
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
  const storyUpdate = useStoryUpdate()

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
   * - 유효 children(이름·나이 둘 다 존재) 이 0개면 에러.
   * - `personId` 없는 아이만 POST /api/persons → 반환 id 를 flow state 에 갱신.
   * - `storyId` 가 이미 있으면 POST /api/stories 스킵 (중복 DRAFT 방지).
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
      // 1) 신규 아이 등록 + flow state 반영
      //    - Promise.all 로 병렬 요청 (N명일 때 직렬 대비 TTV ~N배 단축).
      //    - children 의 원래 순서 유지를 위해 map→all 사용 (Promise.all 은 순서 보존).
      //    - 하나 reject → 전체 reject. "일부만 성공한 채로 step 넘어감" 방지 (기존과 동일한 AllOrNothing 시맨틱).
      //    - idempotent: `if (child.personId) return child` 로 재시도해도 중복 INSERT 없음.
      //    - onChildUpdate 가 병렬로 여러 번 호출되지만 React 19 자동 batching 으로 한 렌더에 묶임.
      const resolved: StoryChild[] = (
        await Promise.all(
          data.children.map(async (child, index) => {
            if (!child.name.trim() || !child.age.trim()) return null
            if (child.personId) return child

            const created = await personPost.mutateAsync({
              name: child.name.trim(),
              birthDate: ageToBirthDate(child.age),
              gender: storyChildGenderToApi(child.gender),
              role: 'CHILD',
            })
            // 다음 번 클릭 시 이 행을 또 POST 하지 않도록 flow state 에 personId 저장.
            onChildUpdate(index, { personId: created.id })
            return { ...child, personId: created.id }
          }),
        )
      ).filter((c): c is StoryChild => c !== null)

      // 2) story 생성 또는 수정 — 이미 있으면 PATCH 로 값 반영, 없으면 새로 POST.
      const mainCharactersPayload = resolved.map(c => ({
        personId: c.personId,
        name: c.name.trim(),
        age: Number.parseInt(c.age, 10) || 0,
        gender: storyChildGenderToApi(c.gender),
      }))
      const storyBody = {
        title: null,
        difficulty: levelToDifficulty(data.level),
        companionsJson: JSON.stringify(data.companions ?? ''),
        mainCharacterJson: JSON.stringify(mainCharactersPayload),
        travelPlace: data.location.trim() || null,
        travelStartDate: firstDate || null,
        travelEndDate: lastDate || null,
      }

      if (storyId !== null) {
        // 뒤로가기 → 값 수정 → 재클릭 시, 서버에도 수정 내용을 반영.
        await storyUpdate.mutateAsync({ id: storyId, body: storyBody })
        onStoryCreated(storyId)
        return
      }

      const response = await storyPost.mutateAsync(storyBody)
      onStoryCreated(response.storyId)
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    data,
    firstDate,
    lastDate,
    onChildUpdate,
    onStoryCreated,
    personPost,
    storyId,
    storyPost,
    storyUpdate,
  ])

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
              <h2 className="text-3xl text-black font-bold">여행 장소와 일정을 입력해주세요</h2>
              <p className="text-black mt-2">동화책의 주인공이 될 아이의 정보를 알려주세요.</p>
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
                <label className="block text-black text-lg mb-2 font-bold">함께 여행한 사람</label>
                <input
                  type="text"
                  placeholder="예: 엄마, 아빠, 할머니, 동생"
                  value={data.companions}
                  onChange={e => onUpdate('companions', e.target.value)}
                  className="w-full p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-xl text-black placeholder-black/60"
                />
              </div>

              <LevelPicker value={data.level} onChange={v => onUpdate('level', v)} />

              <div>
                <label className="block text-black text-lg mb-2 font-bold">여행 일정</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={firstDate}
                    onChange={e => handleDateRangeChange('start', e.target.value)}
                    className="w-full p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-lg text-black"
                  />
                  <input
                    type="date"
                    value={lastDate}
                    onChange={e => handleDateRangeChange('end', e.target.value)}
                    className="w-full p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-lg text-black"
                  />
                </div>
                <p className="text-xs text-black/80 mt-2">
                  TODO(S14P31S210-76, Task 폴리시): 풀 캘린더 그리드로 교체 예정 (원본은 월간 달력 + 다중 날짜 선택).
                </p>
              </div>

              <div>
                <label className="block text-black text-lg mb-2 font-bold">여행 장소</label>
                <input
                  type="text"
                  placeholder="예: 제주도, 부산 해운대, 경주"
                  value={data.location}
                  onChange={e => onUpdate('location', e.target.value)}
                  className="w-full p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-xl text-black placeholder-black/60"
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
