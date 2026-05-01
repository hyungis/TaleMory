import { useCallback, useState } from 'react'
import { AlertCircle, Lock } from 'lucide-react'
import { ApiError } from '../../../../shared/api'
import type { StoryChild, StoryProject } from '../../model/types'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { StepTitleBlock } from '../../ui/StepTitleBlock'
import { clearCreationProgressSnapshot } from '../../lib/progressStorage'
import { LevelPicker } from './LevelPicker'
import { ChildrenList } from './ChildrenList'
import { TravelDatePicker } from './TravelDatePicker'
import type { PersonResponse } from '../api/types'
import { usePersonsQuery } from '../model/usePersonsQuery'
import { usePersonPost } from '../model/usePersonPost'
import { useStoryPost } from '../model/useStoryPost'
import { useStoryUpdate } from '../model/useStoryUpdate'
import { useStoryboardSummaryQuery } from '../../storyboard-prompt'
import {
  apiGenderToStoryChild,
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
  /**
   * sessionStorage 에 남아있던 stale storyId 로 PATCH 가 404 받았을 때 호출.
   * 상위에서 `flow.setStoryId(null)` + `flow.resetProgress()` 로 진행 상태를 비워준다.
   * 미제공 시 storyId 만 컴포넌트 props 로 다시 null 을 받을 때까지 stale 상태가 유지될 수 있다.
   */
  onStaleStoryIdReset?: () => void
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
  onStaleStoryIdReset,
}: BasicInfoStepProps) {
  const firstDate = data.travelDates[0] ?? ''
  const lastDate = data.travelDates[data.travelDates.length - 1] ?? ''

  const personsQuery = usePersonsQuery('CHILD')
  const personPost = usePersonPost()
  const storyPost = useStoryPost()
  const storyUpdate = useStoryUpdate()

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  /**
   * Step 1 락 — SUMMARY 잡이 PENDING/RUNNING/SUCCESS 면 메타 변경(PATCH /api/stories) 금지.
   * BE 의 STEP_LOCKED_BY_SUMMARY (STORY_022) 와 1:1 매칭. 신규 스토리 (storyId === null) 는
   * SUMMARY 가 있을 수 없으므로 query 를 보내지 않음 (`useStoryboardSummaryQuery` 가 disabled).
   *
   * 사용자가 Step 3 진입 후 Step 1 으로 회귀했을 때 메타를 바꾸면 downstream(이미지/스토리)이
   * 입력과 어긋나 깨지므로 차단. UI 는 read-only 배너 + fieldset disabled 로 안내.
   * "사진 선택하러 가기" 버튼은 잠금 시에도 활성 — PATCH 스킵하고 onNext 만 호출.
   */
  const summaryQuery = useStoryboardSummaryQuery(storyId)
  const summaryStatus = summaryQuery.data?.jobStatus ?? null
  const isSummaryLocked =
    summaryStatus === 'PENDING' || summaryStatus === 'RUNNING' || summaryStatus === 'SUCCESS'

  /**
   * TravelDatePicker → travelDates 배열 변환.
   * - end 가 null 이거나 start 와 같음: 단일 일정 → [start]
   * - 다름: 범위 → [start, end]
   * - start 도 null: 빈 배열 (선택 없음)
   */
  const handleDateRangeChange = (start: string | null, end: string | null) => {
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
        age: String(person.age),
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

    // 락 활성 시: PATCH 거부될 게 확실하므로 API 호출 스킵하고 바로 다음 단계로.
    // (storyId 는 SUMMARY 가 있다는 건 이미 존재한다는 뜻 — null 가드는 형식적.)
    if (isSummaryLocked && storyId !== null) {
      onStoryCreated(storyId)
      return
    }

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
              age: Number.parseInt(child.age, 10) || 0,
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
      // sessionStorage 의 옛 storyId 가 DB 에 없으면 PATCH 가 404. (dev DB 리셋, 다른 사용자 등)
      // → 진행 snapshot 을 비우고 부모에 storyId 초기화 요청. 사용자가 다시 클릭하면 POST 모드.
      if (
        storyId !== null &&
        err instanceof ApiError &&
        err.status === 404
      ) {
        clearCreationProgressSnapshot()
        onStaleStoryIdReset?.()
        setSubmitError('이전 작업 정보를 찾을 수 없어 새로 시작합니다. 다시 시도해 주세요.')
        return
      }
      const message = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    data,
    firstDate,
    lastDate,
    isSummaryLocked,
    onChildUpdate,
    onStaleStoryIdReset,
    onStoryCreated,
    personPost,
    storyId,
    storyPost,
    storyUpdate,
  ])

  return (
    <div className="bookshelf-modal step-forest-modal">
      <CreationHeader currentStep={1} />

      <div className="bookshelf-scroll">
        <main className="py-10 px-6 md:px-12 lg:px-24 xl:px-32 2xl:px-40 bookshelf-fade-in">
          <div className="max-w-7xl mx-auto">
            <StepTitleBlock
              stepNumber={1}
              title="가족을 소개해주세요"
              subtitle="이 동화책의 주인공과 등장인물을 알려주세요"
            />

            {/* SUMMARY 락 안내 — 본문 생성이 시작/완료된 스토리는 Step 1 메타 변경 불가. */}
            {isSummaryLocked && (
              <div
                className="bg-[#fff7d6] border-2 border-[#E8A832]/60 text-[#8b6a14] text-sm px-4 py-3 rounded-xl mb-4 flex items-start gap-2"
                role="status"
              >
                <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-bold">본문이 생성되어 이 단계는 읽기 전용이에요.</p>
                  <p className="text-xs mt-1 opacity-90">
                    가족/여행 정보를 바꾸려면 새 동화책을 만들어주세요. 다음 단계로 넘어가면 본문/이미지를 이어 작업할 수 있어요.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-[#f0e6c0] p-8 md:p-10 rounded-2xl shadow-sm border border-[#9A7548]/40">
              {/* fieldset disabled — 안에 있는 모든 native form control(input/button) 을 한 번에 비활성.
                  ChildrenList / LevelPicker / TravelDatePicker 의 input·button 도 모두 같이 잠긴다.
                  border:0 padding:0 으로 fieldset 의 기본 시각 영향 제거 — div 와 동일하게 보이도록. */}
              <fieldset
                disabled={isSummaryLocked}
                className="border-0 p-0 m-0 disabled:opacity-70"
              >
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
                <label className="block text-black text-2xl mb-2 font-bold">함께 여행한 사람</label>
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
                <label className="block text-black text-2xl mb-2 font-bold">여행 일정</label>
                <TravelDatePicker
                  startDate={firstDate || null}
                  endDate={lastDate && lastDate !== firstDate ? lastDate : null}
                  onChange={handleDateRangeChange}
                />
              </div>

              <div>
                <label className="block text-black text-2xl mb-2 font-bold">여행 장소</label>
                <input
                  type="text"
                  placeholder="예: 제주도, 부산 해운대, 경주"
                  value={data.location}
                  onChange={e => onUpdate('location', e.target.value)}
                  className="w-full p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-xl text-black placeholder-black/60"
                />
              </div>
            </div>
              </fieldset>

              {submitError && (
                <div className="mt-6 bg-[#8b3a2a]/15 border border-[#8b3a2a]/40 text-[#8b3a2a] text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <CreationFooter
        currentStep={1}
        onBack={onBack}
        onNext={handleNext}
        nextLabel={
          isSubmitting
            ? '저장 중…'
            : isSummaryLocked
              ? '사진 단계로 이동'
              : '사진 선택하러 가기'
        }
        nextDisabled={isSubmitting}
      />
    </div>
  )
}
