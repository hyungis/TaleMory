import { Palette, Check } from 'lucide-react'
import type { ProjectData, StylePreset } from '../../model/types'
import { StepHeader } from '../../ui/StepHeader'
import { NextButton } from '../../ui/NextButton'
import { STYLE_OPTIONS } from '../lib/styleOptions'

interface StyleSelectorStepProps {
  data: ProjectData['step5']
  onStyleChange: (style: StylePreset) => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 05 — 삽화 스타일 프리셋 선택 (5종 중 1개).
 */
export function StyleSelectorStep({ data, onStyleChange, onBack, onNext }: StyleSelectorStepProps) {
  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={5} stepTitle="삽화 스타일 선택" onBack={onBack} />
      <div className="bookshelf-scroll">
        <main className="py-12 px-6 bookshelf-fade-in">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 text-[#f0e6c0]">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <Palette className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl font-bold">동화책의 스타일을 골라주세요</h2>
              <p className="text-[#b4c4a4] mt-2">선택한 스타일로 전체 페이지가 일관되게 그려져요.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {STYLE_OPTIONS.map(style => {
                const isSelected = data.style === style.id
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => onStyleChange(style.id)}
                    className={`relative rounded-2xl p-6 text-left transition-all border-2 flex flex-col items-start gap-3 ${
                      isSelected
                        ? 'border-[#b4dc8c] shadow-[0_0_25px_rgba(180,220,140,0.55)] scale-[1.02]'
                        : 'border-transparent hover:border-[#8b7a52]/60'
                    } ${style.bg}`}
                  >
                    {style.recommended && (
                      <span className="absolute top-3 right-3 bg-[#2d5a27] text-[#f0e6c0] text-[11px] px-2 py-0.5 rounded-full font-bold">
                        추천
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute top-3 left-3 w-7 h-7 rounded-full bg-[#2d5a27] text-[#f0e6c0] flex items-center justify-center shadow-md">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                    <div className="w-full aspect-[3/4] rounded-xl bg-white/30 mb-2 flex items-center justify-center">
                      <span className="text-[#8b7a52] text-sm">미리보기</span>
                    </div>
                    <div>
                      <h3 className="text-lg text-[#2d5a27] font-bold mb-1">{style.name}</h3>
                      <p className="text-sm text-[#8b7a52]">{style.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="bg-[#f0e6c0] p-6 mt-10 rounded-2xl">
              <NextButton onClick={onNext}>보이스 녹음하러 가기</NextButton>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
