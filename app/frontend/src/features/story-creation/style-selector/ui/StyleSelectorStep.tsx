import { Palette, Check } from 'lucide-react'
import type { ProjectData, StylePreset } from '../../model/types'
import { StepHeader } from '../../ui/StepHeader'
import { NextButton } from '../../ui/NextButton'
import { STYLE_OPTIONS } from '../lib/styleOptions'
import { IllustrationMockup } from '../../../../shared/ui'

interface StyleSelectorStepProps {
  data: ProjectData['step5']
  onStyleChange: (style: StylePreset) => void
  onBack: () => void
  onNext: () => void
}

/**
 * 스타일 프리셋별 미리보기 목업 카드에 보여줄 컬러/텍스처 힌트.
 * 각 스타일의 시각 정체성(watercolor vs digital vs crayon …)을 대충이라도 보여주기 위함.
 */
const STYLE_PREVIEW: Record<
  StylePreset,
  { textColor: string; bg: string; accent: string }
> = {
  watercolor: { textColor: 'text-[#2d5a27]', bg: 'bg-[#fff9dd]', accent: 'text-[#2d5a27]' },
  digital: { textColor: 'text-[#f0e6c0]', bg: 'bg-[#1f2a4a]', accent: 'text-[#b4dc8c]' },
  crayon: { textColor: 'text-[#4a3a14]', bg: 'bg-[#f5ecc6]', accent: 'text-[#c97b4a]' },
  line: { textColor: 'text-[#2a1b12]', bg: 'bg-[#fffbe8]', accent: 'text-[#2a1b12]' },
  collage: { textColor: 'text-[#2a1b12]', bg: 'bg-[#e8ddb4]', accent: 'text-[#8b3a2a]' },
}

/**
 * STEP 05 — 삽화 스타일 프리셋 선택 (5종 중 1개).
 *
 * 각 카드의 미리보기 영역에 IllustrationMockup + 스타일별 컬러 톤으로 목업 연출.
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
                const preview = STYLE_PREVIEW[style.id]
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
                      <span className="absolute top-3 right-3 bg-[#2d5a27] text-[#f0e6c0] text-[11px] px-2 py-0.5 rounded-full font-bold z-10">
                        추천
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute top-3 left-3 w-7 h-7 rounded-full bg-[#2d5a27] text-[#f0e6c0] flex items-center justify-center shadow-md z-10">
                        <Check className="w-4 h-4" />
                      </span>
                    )}

                    {/* 미리보기 목업 */}
                    <div
                      className={`relative w-full aspect-[3/4] rounded-xl mb-2 overflow-hidden ${preview.bg} ${
                        style.id === 'line' ? 'border-2 border-dashed border-[#2a1b12]/40' : ''
                      }`}
                    >
                      <IllustrationMockup
                        variant="scenery"
                        className={`absolute inset-0 w-full h-full ${preview.accent}`}
                      />
                      {/* 콜라주는 종이 오림 느낌을 위해 대각선 레이어 추가 */}
                      {style.id === 'collage' && (
                        <>
                          <div className="absolute top-6 left-4 w-10 h-10 bg-[#c97b4a]/30 rotate-12 rounded-sm" />
                          <div className="absolute bottom-10 right-6 w-12 h-8 bg-[#2d5a27]/30 -rotate-6 rounded-sm" />
                        </>
                      )}
                      {/* 크레용은 거친 텍스처 오버레이 */}
                      {style.id === 'crayon' && (
                        <div
                          className="absolute inset-0 mix-blend-multiply opacity-30 pointer-events-none"
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(45deg, rgba(201,123,74,0.25) 0 2px, transparent 2px 6px)',
                          }}
                        />
                      )}
                      {/* 스타일 라벨 */}
                      <div className="absolute bottom-2 left-2 right-2 text-center">
                        <span
                          className={`inline-block text-[10px] uppercase tracking-widest ${preview.textColor} font-bold px-2 py-0.5 rounded bg-black/5 backdrop-blur-sm`}
                        >
                          {style.id}
                        </span>
                      </div>
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
