import { useState } from 'react'
import { RefreshCcw, LayoutGrid } from 'lucide-react'
import type { ProjectData } from '../../model/types'
import { StepHeader } from '../../ui/StepHeader'
import { NextButton } from '../../ui/NextButton'
import { MAX_GLOBAL_REFINE, MAX_PER_PAGE_REFINE } from '../lib/defaults'

interface StoryboardEditorStepProps {
  data: ProjectData['step4']
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 04 — 스토리보드 페이지 그리드 편집 + 개별 페이지 AI 재생성.
 *
 * 현재(Task 5)는 페이지 리스트 보기 + 카운터만. 실제 재생성 API 는 미연결.
 */
export function StoryboardEditorStep({ data, onBack, onNext }: StoryboardEditorStepProps) {
  const [globalRemaining] = useState(MAX_GLOBAL_REFINE)
  const pageRemainings = data.pages.map(() => MAX_PER_PAGE_REFINE)

  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={4} stepTitle="스토리보드 확인" onBack={onBack} />
      <div className="bookshelf-scroll">
        <main className="py-12 px-6 bookshelf-fade-in">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8 text-[#f0e6c0]">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <LayoutGrid className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl font-bold">각 페이지를 확인하고 다듬어보세요</h2>
              <p className="text-[#b4c4a4] mt-2">
                전체 AI 재수정 남은 횟수: {globalRemaining} / {MAX_GLOBAL_REFINE} · 페이지당 최대 {MAX_PER_PAGE_REFINE}회
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.pages.map((page, idx) => (
                <div
                  key={idx}
                  className="bg-[#f0e6c0] rounded-2xl p-5 border-2 border-[#8b7a52]/40 shadow-[0_6px_20px_rgba(0,0,0,0.4)] flex flex-col"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-[#2d5a27] text-[#f0e6c0] text-xs px-3 py-1 rounded-full font-bold">
                      페이지 {idx + 1}
                    </span>
                    <span className="text-xs text-[#8b7a52]">
                      남은 재생성: {pageRemainings[idx]}
                    </span>
                  </div>
                  <div className="aspect-[3/4] rounded-lg bg-gradient-to-br from-[#e8ddb4] to-[#d4b86a] mb-3 flex items-center justify-center text-[#8b7a52] text-sm p-3 text-center">
                    🎨 {page.sketch}
                  </div>
                  <p className="text-sm text-[#2d5a27] font-bold mb-1 line-clamp-2">{page.en}</p>
                  <p className="text-xs text-[#8b7a52] mb-3 line-clamp-2">{page.ko}</p>
                  <button
                    type="button"
                    disabled={pageRemainings[idx] === 0}
                    className="mt-auto bg-[#8b7a52] text-[#f0e6c0] py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 hover:bg-[#a89664] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCcw className="w-4 h-4" /> 이 페이지 다시 그리기
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-[#f0e6c0] p-6 mt-10 rounded-2xl">
              <NextButton onClick={onNext}>스타일 고르러 가기</NextButton>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
