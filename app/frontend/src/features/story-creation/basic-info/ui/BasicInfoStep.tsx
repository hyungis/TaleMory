import { useCallback, useState } from 'react'
import { AlertCircle, Lock } from 'lucide-react'
import { ApiError } from '../../../../shared/api'
import type { StoryId } from '../../../../shared/types'
import type { StoryChild, StoryProject } from '../../model/types'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
import { StepTitleBlock } from '../../ui/StepTitleBlock'
import { clearCreationProgressSnapshot } from '../../lib/progressStorage'
import { LevelPicker } from './LevelPicker'
import { ChildrenList } from './ChildrenList'
import { TravelDatePicker } from './TravelDatePicker'
import type { PersonResponse, StoryModeApi } from '../api/types'
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
import '../../styles/creation-paper.css'

interface BasicInfoStepProps {
  data: StoryProject['step1']
  storyId: StoryId | null
  /**
   * 동화 생성 모드 (VIEWER / WEBTOON). POST /api/stories body 에 그대로 전달.
   * useStoryCreationFlow 가 mount 시 결정한 값이 내려오며 플로우 내에서 변경되지 않는다.
   * PATCH 시에는 보내지 않음 — 모드는 생성 시 한 번만 결정.
   */
  mode: StoryModeApi
  onUpdate: <K extends keyof StoryProject['step1']>(key: K, value: StoryProject['step1'][K]) => void
  onChildUpdate: (index: number, patch: Partial<StoryChild>) => void
  onChildAdd: () => void
  onChildAppend: (child: StoryChild) => void
  onChildRemove: (index: number) => void
  readOnly?: boolean
  onBack: () => void
  onStoryCreated: (storyId: StoryId) => void
  onStaleStoryIdReset?: () => void
}

/**
 * STEP 01 — paper-craft 톤 (Claude offline.html 1:1).
 *
 * 본문(`<form>` 영역)은 기존 React Query 로직(POST/PATCH /api/stories, /api/persons,
 * SUMMARY 락 검사) 그대로 유지하고, 마크업/스타일만 `.cr-shell` + `.cr-card` + `.cr-field`
 * 등 paper-craft 클래스로 갈아엎음.
 */
export function BasicInfoStep({
  data,
  storyId,
  mode,
  onUpdate,
  onChildUpdate,
  onChildAdd,
  onChildAppend,
  onChildRemove,
  readOnly = false,
  onBack,
  onStoryCreated,
  onStaleStoryIdReset,
}: BasicInfoStepProps) {
  const firstDate = data.travelDates[0] ?? ''
  // 두 항목이 모두 있을 때만 lastDate 가 의미 있음.
  // 한 개([a])는 "출발일만 선택, 도착일 미정", 두 개([a, a])는 "당일치기 확정".
  const lastDate =
    data.travelDates.length >= 2
      ? data.travelDates[data.travelDates.length - 1] ?? ''
      : ''

  const personsQuery = usePersonsQuery('CHILD')
  const personPost = usePersonPost()
  const storyPost = useStoryPost()
  const storyUpdate = useStoryUpdate()

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const summaryQuery = useStoryboardSummaryQuery(storyId)
  const summaryStatus = summaryQuery.data?.jobStatus ?? null
  const isSummaryLocked =
    summaryStatus === 'PENDING' || summaryStatus === 'RUNNING' || summaryStatus === 'SUCCESS'
  const isReadOnly = isSummaryLocked || readOnly

  const handleDateRangeChange = (start: string | null, end: string | null) => {
    // 당일치기(start === end)도 [start, end] 두 개 모두 저장해야
    // TravelDatePicker 가 "도착일 미정" 상태와 "당일치기" 상태를 구분할 수 있다.
    const next: string[] = []
    if (start) next.push(start)
    if (end) next.push(end)
    onUpdate('travelDates', next)
  }

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

  const handleNext = useCallback(async () => {
    setSubmitError(null)

    if (isReadOnly && storyId !== null) {
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
            onChildUpdate(index, { personId: created.id })
            return { ...child, personId: created.id }
          }),
        )
      ).filter((c): c is StoryChild => c !== null)

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
        // PATCH 는 mode 를 보내지 않음 — 모드는 최초 POST 때 한 번만 결정 후 영속화.
        // ModifyStoryRequest 타입에도 mode 필드 없음 → 컴파일 시점 보호.
        await storyUpdate.mutateAsync({ id: storyId, body: storyBody })
        onStoryCreated(storyId)
        return
      }

      // 신규 POST 만 mode 를 함께 전달 → BE 가 stories.mode 컬럼에 저장.
      const response = await storyPost.mutateAsync({ ...storyBody, mode })
      onStoryCreated(response.storyId)
    } catch (err) {
      if (storyId !== null && err instanceof ApiError && err.status === 404) {
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
    isReadOnly,
    mode,
    onChildUpdate,
    onStaleStoryIdReset,
    onStoryCreated,
    personPost,
    storyId,
    storyPost,
    storyUpdate,
  ])

  return (
    <div className="cr-shell">
      <CreationDoodlesBg />
      <CreationHeader currentStep={1} />

      <div className="cr-scroll">
        <main className="cr-shell-inner cr-fade-in">
          <StepTitleBlock
            stepNumber={1}
            title="가족을 소개해주세요"
            subtitle="이 동화책의 주인공과 함께한 분들을 알려주세요"
          />

          {/* SUMMARY 락 안내 */}
          {isReadOnly && (
            <div className="cr-banner" role="status">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <strong>
                  {readOnly && !isSummaryLocked
                    ? '최종삽화가 생성되어 이 단계는 읽기 전용이에요.'
                    : '본문이 생성되어 이 단계는 읽기 전용이에요.'}
                </strong>
                <span style={{ fontSize: 18, opacity: 0.9 }}>
                  {readOnly && !isSummaryLocked
                    ? '가족/여행 정보를 바꾸려면 새 동화책을 만들어주세요. 다음 단계로 진행하면 최종 작업을 이어갈 수 있어요.'
                    : '가족/여행 정보를 바꾸려면 새 동화책을 만들어주세요. 다음 단계로 넘어가면 본문/이미지를 이어 작업할 수 있어요.'}
                </span>
              </div>
            </div>
          )}

          <div className="cr-card" data-onboarding-target="creation-basic-info">
            <span className="cr-tape" aria-hidden="true" />

            {/* fieldset 으로 잠금 시 모든 form control 일괄 비활성. */}
            <fieldset
              disabled={isReadOnly}
              style={{
                border: 0,
                padding: 0,
                margin: 0,
                opacity: isReadOnly ? 0.7 : 1,
              }}
            >
              <ChildrenList
                children={data.children}
                onChildUpdate={onChildUpdate}
                onChildAdd={onChildAdd}
                onChildRemove={onChildRemove}
                existingPersons={personsQuery.data}
                onLoadPerson={handleLoadPerson}
              />

              <div className="cr-field">
                <label className="cr-label">함께 여행한 사람</label>
                <input
                  type="text"
                  placeholder="예: 엄마, 아빠, 할머니, 동생"
                  value={data.companions}
                  onChange={e => onUpdate('companions', e.target.value)}
                  className="cr-input"
                />
              </div>

              <LevelPicker
                value={data.level}
                onChange={v => onUpdate('level', v)}
                disabled={isReadOnly}
              />

              <div className="cr-field">
                <label className="cr-label">여행 일정</label>
                <TravelDatePicker
                  startDate={firstDate || null}
                  endDate={lastDate || null}
                  onChange={handleDateRangeChange}
                />
              </div>

              <div className="cr-field">
                <label className="cr-label">여행 장소</label>
                <input
                  type="text"
                  placeholder="예: 제주도, 부산 해운대, 경주"
                  value={data.location}
                  onChange={e => onUpdate('location', e.target.value)}
                  className="cr-input"
                />
              </div>
            </fieldset>

            {submitError && (
              <div
                className="cr-banner error"
                style={{ marginTop: 16, marginBottom: 0 }}
                role="alert"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            )}
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
            : isReadOnly
              ? '사진 단계로 이동'
              : '사진 업로드하러 가기'
        }
        nextDisabled={isSubmitting}
      />
    </div>
  )
}
