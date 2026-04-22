import { useCallback, useState, type KeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpenCheck, Info, Send, Sparkles, Wand2 } from 'lucide-react'
import type { ProjectData } from '../../model/types'
import { REFINE_QUICK_TAGS } from '../lib/defaults'

interface StoryTextStepProps {
  data: ProjectData['step3']
  onStoryChange: (story: string) => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 03 — "스토리 구성하기"
 *
 * - "AI가 이야기를 만들었어요" 배지 + 헤더 + 부제
 * - 줄거리 카드: 제목/글자수 카운트 + textarea + 하단 힌트
 * - 카드 하단 AI 재수정 영역: 입력 + Enter 동작 + "요청" 버튼 + 4개 빠른 태그
 * - 하단 액션 바: "이전" / "스토리 확정하고 스토리보드 보기"
 *
 * AI 재수정 호출은 stub(alert). 백엔드 연동 시 실제 API 호출로 교체.
 */
export function StoryTextStep({ data, onStoryChange, onBack, onNext }: StoryTextStepProps) {
  const [refinePrompt, setRefinePrompt] = useState('')

  const requestAiRefine = useCallback(() => {
    const val = refinePrompt.trim()
    if (!val) {
      alert('어떻게 수정하고 싶은지 입력해 주세요!')
      return
    }
    // TODO(S14P31S210-76): AI 스토리 재수정 API 호출
    alert(`AI에게 '${val}' 조건으로 수정을 요청합니다...`)
    setRefinePrompt('')
  }, [refinePrompt])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      requestAiRefine()
    }
  }

  return (
    <div className="bookshelf-modal step-forest-modal">
      {/* Step 헤더 */}
      <div className="flex items-center justify-between py-4 px-8 border-b border-[#4a3a24] bg-[#2a1b12]/60 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="이전 단계"
            className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-[#4a3a24] text-[#d6c78e] bg-[#2a1b12]/70 hover:bg-[#2d5a27]/40 hover:text-[#f0e6c0] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-[#b4c4a4] text-sm font-bold tracking-wider">STEP 03 / 08</span>
          <span className="bookshelf-title-display text-2xl text-[#f0e6c0] font-bold">스토리 구성하기</span>
        </div>
      </div>

      <div className="bookshelf-scroll">
        <main className="py-10 px-6 bookshelf-fade-in">
          <div className="max-w-3xl mx-auto pb-12">
            {/* 타이틀 */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-[#2d5a27]/60 px-4 py-1.5 rounded-full border border-[#b4dc8c]/50 mb-4 shadow-sm">
                <Sparkles className="w-4 h-4 text-[#b4dc8c]" />
                <span className="text-[#b4dc8c] text-sm font-bold">AI가 이야기를 만들었어요</span>
              </div>
              <h1 className="text-3xl md:text-4xl text-[#f0e6c0] mb-3 font-bold">
                우리 가족의 특별한 줄거리
              </h1>
              <p className="text-[#b4c4a4] text-lg">
                전체적인 흐름이 마음에 드시나요?
                <br />
                아래 내용을 직접 수정하거나 AI에게 다시 부탁할 수 있어요.
              </p>
            </div>

            {/* 줄거리 카드 */}
            <div className="bg-[#f0e6c0] rounded-[2.5rem] border-2 border-[#2a1b12] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden mb-8">
              <div className="p-6 md:p-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl text-[#2d5a27] flex items-center gap-2 font-bold">
                    <BookOpenCheck className="w-7 h-7" />
                    동화책 줄거리 요약
                  </h2>
                  <span className="text-[#8b7a52] text-sm font-sans">약 {data.story.length}자</span>
                </div>

                <textarea
                  value={data.story}
                  onChange={e => onStoryChange(e.target.value)}
                  placeholder="이야기 내용을 입력해주세요..."
                  className="w-full h-64 p-6 rounded-2xl bg-[#e8ddb4] border-2 border-[#8b7a52]/60 text-[#2d5a27] text-lg leading-relaxed focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/30 focus:outline-none resize-none font-sans"
                />

                <div className="mt-4 flex justify-end">
                  <p className="text-[#8b7a52] text-sm flex items-center gap-1">
                    <Info className="w-4 h-4" /> 위 텍스트를 직접 클릭해서 수정할 수 있습니다.
                  </p>
                </div>
              </div>

              {/* AI 재수정 요청 */}
              <div className="bg-[#e8ddb4] p-6 md:p-8 border-t-2 border-[#8b7a52]/40">
                <label className="flex items-center gap-2 text-[#2d5a27] font-bold mb-3 text-lg">
                  <Wand2 className="w-5 h-5" /> AI에게 내용 수정 요청하기
                </label>
                <div className="flex gap-2">
                  <input
                    value={refinePrompt}
                    onChange={e => setRefinePrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    type="text"
                    placeholder="예: '조금 더 감동적인 말투로 바꿔줘', '아이의 시점에서 일기처럼 써줘'"
                    className="flex-1 p-4 rounded-xl border-2 border-[#b4dc8c] bg-[#f0e6c0] focus:border-[#2d5a27] focus:outline-none text-lg font-sans text-[#2d5a27] placeholder-[#8b7a52]/60"
                  />
                  <button
                    type="button"
                    onClick={requestAiRefine}
                    className="bg-[#2d5a27] text-[#f0e6c0] px-6 py-4 rounded-xl font-bold hover:bg-[#3d6f34] border border-[#b4dc8c]/40 transition-colors flex items-center gap-2 shadow-[0_4px_0_#1a3a14]"
                  >
                    요청 <Send className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {REFINE_QUICK_TAGS.map(t => (
                    <button
                      key={t.text}
                      type="button"
                      onClick={() => setRefinePrompt(t.text)}
                      className="px-3 py-1.5 bg-[#f0e6c0] border-2 border-[#b4dc8c] rounded-full text-sm text-[#2d5a27] hover:bg-[#2d5a27] hover:text-[#f0e6c0] font-bold transition-colors shadow-sm"
                    >
                      {t.emoji} {t.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 하단 액션 */}
            <div className="flex justify-between items-center pt-6 border-t border-[#4a3a24]">
              <button
                type="button"
                onClick={onBack}
                className="text-[#b4c4a4] hover:text-[#f0e6c0] px-4 py-2 text-lg font-bold transition-colors"
              >
                이전
              </button>
              <button
                type="button"
                onClick={onNext}
                className="bg-[#2d5a27] text-[#f0e6c0] px-10 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.5)] hover:bg-[#3d6f34] transition-all font-bold flex items-center gap-2 text-xl whitespace-nowrap"
              >
                스토리 확정하고 스토리보드 보기 <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
