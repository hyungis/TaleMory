import { Check, Loader2 } from 'lucide-react'
import type { StoryProject, StylePresetCode } from '../../model/types'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
import { StepTitleBlock } from '../../ui/StepTitleBlock'
import { useStylePresetsQuery } from '../model/useStylePresetsQuery'
import { useStoryStylePatch } from '../model/useStoryStylePatch'
import '../../styles/creation-paper.css'

interface StyleSelectorStepProps {
  data: StoryProject['step5']
  storyId: number | null
  onStyleChange: (style: StylePresetCode) => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 05 — paper-craft 톤 (Claude offline.html 1:1).
 * 서버에서 프리셋 목록을 조회하고, 선택 시 PATCH 로 저장한 뒤 다음 단계로 이동.
 */
export function StyleSelectorStep({ data, storyId, onStyleChange, onBack, onNext }: StyleSelectorStepProps) {
  const presetsQuery = useStylePresetsQuery()
  const stylePatch = useStoryStylePatch(storyId)

  const handleNext = () => {
    const selected = presetsQuery.data?.find(p => p.code === data.style)
    if (!selected) return
    if (storyId === null) {
      onNext()
      return
    }
    stylePatch.mutate(selected.id, { onSuccess: () => onNext() })
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
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onStyleChange(preset.code as StylePresetCode)}
                    className={`cr-style-card${isSelected ? ' on' : ''}`}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <span className="cr-style-check" aria-hidden="true">
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
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
    </div>
  )
}
