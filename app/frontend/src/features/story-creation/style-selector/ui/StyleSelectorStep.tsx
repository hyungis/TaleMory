import { Check, Loader2 } from 'lucide-react'
import type { StoryProject, StylePresetCode } from '../../model/types'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { StepTitleBlock } from '../../ui/StepTitleBlock'
import { useStylePresetsQuery } from '../model/useStylePresetsQuery'
import { useStoryStylePatch } from '../model/useStoryStylePatch'

interface StyleSelectorStepProps {
  data: StoryProject['step5']
  storyId: number | null
  onStyleChange: (style: StylePresetCode) => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 05 — 삽화 스타일 프리셋 선택.
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
    <div className="bookshelf-modal step-forest-modal">
      <CreationHeader currentStep={5} />
      <div className="bookshelf-scroll">
        <main className="py-10 px-6 md:px-12 lg:px-24 xl:px-32 2xl:px-40 bookshelf-fade-in">
          <div className="max-w-7xl mx-auto pb-12">
            <StepTitleBlock
              stepNumber={5}
              title="삽화 스타일을 골라주세요"
              subtitle="선택한 스타일로 전체 페이지가 일관되게 그려져요"
            />

            {presetsQuery.isLoading && (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 text-[#3F6B2E] animate-spin mx-auto" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(presetsQuery.data ?? []).map(preset => {
                const isSelected = data.style === preset.code
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onStyleChange(preset.code as StylePresetCode)}
                    className={`relative rounded-2xl p-4 text-left transition-all border-2 flex flex-col items-start gap-2 bg-gradient-to-br from-[#F4E4BC] to-[#B9D38F]/50 ${
                      isSelected
                        ? 'border-[#3F6B2E] shadow-[0_0_20px_rgba(63,107,46,0.3)] scale-[1.02]'
                        : 'border-[#9A7548]/30 hover:border-[#3F6B2E]/60'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#3F6B2E] text-[#FFFEF8] flex items-center justify-center shadow-md z-10 border border-[#B9D38F]/50">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {/* 미리보기 이미지 — 정사각형으로 축소 */}
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden">
                      {preset.previewUrl && (
                        <img
                          src={preset.previewUrl}
                          alt={`${preset.name} 미리보기`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <h3 className="text-sm md:text-base text-[#3E2A18] font-bold">{preset.name}</h3>
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
        nextLabel={stylePatch.isPending ? '저장 중...' : '보이스 녹음하러 가기'}
        nextDisabled={!data.style || stylePatch.isPending}
      />
    </div>
  )
}
