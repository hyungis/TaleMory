import { useState } from 'react'
import { Sparkles, BookText } from 'lucide-react'
import type { ProjectData } from '../../model/types'
import { StepHeader } from '../../ui/StepHeader'
import { NextButton } from '../../ui/NextButton'
import { REFINE_QUICK_TAGS } from '../lib/defaults'

interface StoryTextStepProps {
  data: ProjectData['step3']
  onStoryChange: (story: string) => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 03 — AI 가 생성한 스토리 본문 확인 + 재수정 요청.
 * 실제 AI refine 호출은 후속 API 연동 커밋에서.
 */
export function StoryTextStep({ data, onStoryChange, onBack, onNext }: StoryTextStepProps) {
  const [refinePrompt, setRefinePrompt] = useState('')

  const handleRequestRefine = () => {
    // TODO(S14P31S210-76): AI refine API 호출 (story + prompt → new story)
    alert(`AI 재수정 요청 (stub): "${refinePrompt}"\n실제 연동은 API 붙이면서 추가됩니다.`)
  }

  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={3} stepTitle="스토리 본문 확인" onBack={onBack} />
      <div className="bookshelf-scroll">
        <main className="py-12 px-6 bookshelf-fade-in">
          <div className="max-w-3xl mx-auto bg-[#f0e6c0] p-8 md:p-12 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-2 border-[#2a1b12]">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <BookText className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl text-[#2d5a27] font-bold">스토리를 읽어보세요</h2>
              <p className="text-[#8b7a52] mt-2">마음에 들지 않으면 AI 에게 재수정을 요청할 수 있어요.</p>
            </div>

            <textarea
              value={data.story}
              onChange={e => onStoryChange(e.target.value)}
              rows={10}
              className="w-full p-4 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-base text-[#2d5a27] leading-7 resize-none"
            />

            <div className="mt-6 bg-[#e8ddb4]/60 border-2 border-[#8b7a52]/40 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-[#2d5a27]" />
                <span className="text-[#2d5a27] font-bold">AI 재수정 요청</span>
              </div>
              <input
                type="text"
                value={refinePrompt}
                onChange={e => setRefinePrompt(e.target.value)}
                placeholder="예: 더 감동적으로 바꿔주세요"
                className="w-full p-3 bg-[#f0e6c0] border border-[#8b7a52]/40 rounded-lg text-[#2d5a27] placeholder-[#8b7a52]/60 mb-2"
              />
              <div className="flex flex-wrap gap-2 mb-3">
                {REFINE_QUICK_TAGS.map(tag => (
                  <button
                    key={tag.text}
                    type="button"
                    onClick={() => setRefinePrompt(tag.text)}
                    className="px-3 py-1.5 bg-[#f0e6c0] border border-[#8b7a52]/50 rounded-full text-sm text-[#2d5a27] hover:bg-[#2d5a27] hover:text-[#f0e6c0] hover:border-[#2d5a27] transition-colors"
                  >
                    {tag.emoji} {tag.text}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleRequestRefine}
                disabled={!refinePrompt.trim()}
                className="w-full bg-[#2d5a27] text-[#f0e6c0] py-3 rounded-lg font-bold hover:bg-[#3d6f34] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                AI 에게 다시 써달라고 하기
              </button>
            </div>

            <NextButton onClick={onNext}>스토리보드 보러 가기</NextButton>
          </div>
        </main>
      </div>
    </div>
  )
}
