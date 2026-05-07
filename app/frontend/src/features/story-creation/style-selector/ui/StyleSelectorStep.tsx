import { useState } from 'react'
import { Check, Loader2, Lock, PartyPopper } from 'lucide-react'
import type { StoryProject, StylePresetCode } from '../../model/types'
import type { JobId, StoryId } from '../../../../shared/types'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
import { StepTitleBlock } from '../../ui/StepTitleBlock'
import { useStylePresetsQuery } from '../model/useStylePresetsQuery'
import { useStoryStylePatch } from '../model/useStoryStylePatch'
import '../../styles/creation-paper.css'

interface StyleSelectorStepProps {
  data: StoryProject['step5']
  storyId: StoryId | null
  onStyleChange: (style: StylePresetCode) => void
  onBack: () => void
  onNext: () => void
  /**
   * Step 5 PATCH /style 응답으로 받은 FINAL_ILLUSTRATION 잡 id 를 store 에 저장한다.
   * Step 8 FinalPreviewStep 가 이 jobId 로 폴링.
   */
  setFinalIllustrationJobId: (jobId: JobId) => void
  /**
   * 이미 PATCH /style 이 완료되어 백그라운드 FINAL_ILLUSTRATION 잡이 시작됐는지 판단용.
   * non-null 이면 사용자가 step 6→7 진행 중 step 5 로 다시 돌아온 케이스 → 카드 선택 잠금
   * (스타일 변경하면 잡 중복 발행 + 옛 잡이 orphan 되는 자원 낭비 방지).
   */
  finalIllustrationJobId: JobId | null
  /**
   * 크롬 종료로 sessionStorage 가 비워진 뒤 "이어서 작성하기" 로 재진입한 경우,
   * `finalIllustrationJobId` 는 in-memory 라 null 로 시작한다. 이 때 BE 의 진실
   * (Story.stylePresetId 가 박혀있음) 을 반영한 `storyboardReadOnlyLocked` 가 별도
   * 신호로 들어오므로, 이 prop 으로도 lock 을 derive 한다.
   */
  readOnly?: boolean
}

/**
 * STEP 05 — paper-craft 톤 (Claude offline.html 1:1).
 * 서버에서 프리셋 목록을 조회하고, 선택 시 PATCH 로 저장한 뒤 다음 단계로 이동.
 *
 * 잠금 정책:
 * - 첫 진입: 카드 선택 자유 + "다음" 클릭 시 확인 모달 → 확인 시 PATCH + 다음
 * - 재진입 (finalIllustrationJobId 있음): 카드 모두 disabled + 선택된 스타일에 잠금 뱃지 + 모달 없이 바로 다음
 */
export function StyleSelectorStep({
  data,
  storyId,
  onStyleChange,
  onBack,
  onNext,
  setFinalIllustrationJobId,
  finalIllustrationJobId,
  readOnly = false,
}: StyleSelectorStepProps) {
  const presetsQuery = useStylePresetsQuery()
  const stylePatch = useStoryStylePatch(storyId)
  const [showConfirm, setShowConfirm] = useState(false)

  // 둘 중 하나라도 true 면 잠금:
  //  - finalIllustrationJobId !== null : 같은 세션에서 PATCH 직후 (in-memory).
  //  - readOnly                        : "이어서 작성하기" 진입 시 BE 진실 (stylePresetId !== null).
  // 크롬 종료로 sessionStorage 가 비워져도 readOnly 가 lock 을 유지한다.
  const isLocked = finalIllustrationJobId !== null || readOnly

  const handleNext = () => {
    if (!data.style) return
    if (isLocked) {
      // 이미 PATCH 완료된 상태 — 모달 없이 바로 다음 단계로.
      onNext()
      return
    }
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    const selected = presetsQuery.data?.find(p => p.code === data.style)
    if (!selected) return
    setShowConfirm(false)
    if (storyId === null) {
      onNext()
      return
    }
    stylePatch.mutate(selected.id, {
      onSuccess: response => {
        setFinalIllustrationJobId(response.finalIllustrationJobId)
        onNext()
      },
    })
  }

  return (
    <div className="cr-shell">
      <CreationDoodlesBg />
      <CreationHeader currentStep={5} />
      <div className="cr-scroll">
        <main className="cr-shell-inner cr-fade-in">
          <StepTitleBlock
            stepNumber={5}
            title="삽화 스타일을 골라주세요"
            subtitle="선택한 스타일로 전체 페이지가 일관되게 그려져요"
          />

          {/* 락 안내 — step 1/2/3 와 동일한 노란 cr-banner 톤. 백그라운드 삽화 생성이 시작되어 변경 불가. */}
          {isLocked && (
            <div className="cr-banner" role="status">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <strong>스타일이 확정되어 이 단계는 읽기 전용이에요.</strong>
                <span style={{ fontSize: 18, opacity: 0.9 }}>
                  다른 스타일로 바꾸려면 새 동화책을 만들어주세요. 선택한 스타일로 삽화가 그려지고 있어요.
                </span>
              </div>
            </div>
          )}

          {presetsQuery.isLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Loader2
                className="w-10 h-10 animate-spin"
                style={{ color: 'var(--cr-sage-deep)', margin: '0 auto' }}
              />
            </div>
          )}

          <div className="cr-card">
            <span className="cr-tape" aria-hidden="true" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 14,
              }}
            >
              {(presetsQuery.data ?? []).map(preset => {
                const isSelected = data.style === preset.code
                const cardDisabled = isLocked && !isSelected
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={isLocked ? undefined : () => onStyleChange(preset.code as StylePresetCode)}
                    disabled={isLocked}
                    className={`cr-style-card${isSelected ? ' on' : ''}`}
                    aria-pressed={isSelected}
                    style={{
                      opacity: cardDisabled ? 0.4 : 1,
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isSelected && (
                      <span className="cr-style-check" aria-hidden="true">
                        {isLocked ? (
                          <Lock className="w-3.5 h-3.5" strokeWidth={3} />
                        ) : (
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        )}
                      </span>
                    )}
                    <div className="cr-style-thumb">
                      {preset.previewUrl && (
                        <img src={preset.previewUrl} alt={`${preset.name} 미리보기`} />
                      )}
                    </div>
                    <h3 className="cr-style-name">{preset.name}</h3>
                  </button>
                )
              })}
            </div>
          </div>
        </main>
      </div>

      <CreationFooter
        currentStep={5}
        onBack={onBack}
        onNext={handleNext}
        nextLabel={stylePatch.isPending ? '저장 중…' : '보이스 녹음하러 가기'}
        nextDisabled={!data.style || stylePatch.isPending}
      />

      {/* 첫 선택 시 확인 모달 — 백그라운드 삽화 생성이 시작되어 이후엔 변경 불가하다는 안내. */}
      {showConfirm && (
        <div
          className="cr-publish-confirm-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowConfirm(false)}
        >
          <div className="cr-publish-confirm-card" onClick={e => e.stopPropagation()}>
            <span className="cr-tape" aria-hidden="true" />
            <h3 className="cr-publish-confirm-title">이 스타일로 진행할까요?</h3>
            <p className="cr-publish-confirm-desc">
              이 스타일로 삽화 그리기를 시작하면
              <br />
              다른 스타일로 바꿀 수 없어요.
            </p>
            <div className="cr-publish-confirm-actions">
              <button
                type="button"
                className="cr-publish-confirm-cancel"
                onClick={() => setShowConfirm(false)}
              >
                다시 고를게요
              </button>
              <button
                type="button"
                className="cr-publish-confirm-submit"
                onClick={handleConfirm}
                disabled={stylePatch.isPending}
              >
                <PartyPopper className="w-4 h-4" />
                네, 이걸로 그려주세요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
