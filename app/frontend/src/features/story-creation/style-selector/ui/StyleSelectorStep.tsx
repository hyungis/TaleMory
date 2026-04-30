import { Palette, Check, Loader2 } from 'lucide-react'
import type { StoryProject, StylePresetCode } from '../../model/types'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
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
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 text-[#f0e6c0]">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <Palette className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl font-bold">동화책의 스타일을 골라주세요</h2>
              <p className="text-[#b4c4a4] mt-2">선택한 스타일로 전체 페이지가 일관되게 그려져요.</p>
            </div>

            {presetsQuery.isLoading && (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 text-[#b4dc8c] animate-spin mx-auto" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(presetsQuery.data ?? []).map(preset => {
                const isSelected = data.style === preset.code
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onStyleChange(preset.code as StylePresetCode)}
                    className={`relative rounded-2xl p-6 text-left transition-all border-2 flex flex-col items-start gap-3 bg-gradient-to-br from-[#e8ddb4] to-[#b4dc8c]/60 ${
                      isSelected
                        ? 'border-[#b4dc8c] shadow-[0_0_25px_rgba(180,220,140,0.55)] scale-[1.02]'
                        : 'border-transparent hover:border-[#8b7a52]/60'
                    }`}
                  >
                    {preset.code === 'watercolor' && (
                      <span className="absolute top-3 right-3 bg-[#2d5a27] text-[#f0e6c0] text-[11px] px-2 py-0.5 rounded-full font-bold z-10">
                        추천
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute top-3 left-3 w-7 h-7 rounded-full bg-[#2d5a27] text-[#f0e6c0] flex items-center justify-center shadow-md z-10">
                        <Check className="w-4 h-4" />
                      </span>
                    )}

                    {/* 미리보기 이미지 */}
                    <div className="relative w-full aspect-[3/4] rounded-xl mb-2 overflow-hidden">
                      {preset.previewUrl && (
                        <img
                          src={preset.previewUrl}
                          alt={`${preset.name} 미리보기`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg text-[#2d5a27] font-bold mb-1">{preset.name}</h3>
                    </div>
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
