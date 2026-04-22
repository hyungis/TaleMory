import { Sparkles, Wand2, X } from 'lucide-react'

const QUICK_TAGS = ['✨ 판타지 모험', '💖 감동적인', '😂 코믹하고 신나는'] as const

interface StoryPromptModalProps {
  isOpen: boolean
  prompt: string
  onPromptChange: (value: string) => void
  onClose: () => void
  /** "마법 주문 적용!" — step 3 로 진행. */
  onApply: () => void
}

/**
 * "스토리보드 마법 주문" 모달.
 *
 * 원본 App.jsx 에서 step 2 하단 "스토리보드 만들기" 버튼을 누르면 띄워지는 프롬프트 입력 오버레이.
 * 모달 내부:
 *  - 장르/분위기 설명 헤더
 *  - 자유 텍스트 textarea (projectData.step2.prompt 와 bind)
 *  - 3 개 빠른 태그 append 버튼
 *  - "마법 주문 적용!" → onApply() 로 step 3 진행
 *
 * 백드롭 클릭 시 닫힘, 내부 컨테이너는 stopPropagation.
 */
export function StoryPromptModal({
  isOpen,
  prompt,
  onPromptChange,
  onClose,
  onApply,
}: StoryPromptModalProps) {
  if (!isOpen) return null

  const appendTag = (tag: string) => {
    const current = prompt.trim()
    onPromptChange(current ? `${current} ${tag}` : tag)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center bookshelf-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#f0e6c0] w-11/12 max-w-2xl rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden relative border-2 border-[#2a1b12]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#2a1b12] p-6 border-b border-[#4a3a24] flex justify-between items-center">
          <h3 className="text-2xl text-[#f0e6c0] flex items-center gap-3 font-bold">
            <span className="bg-[#2d5a27] text-[#b4dc8c] p-2 rounded-xl shadow-[0_0_14px_rgba(180,220,140,0.3)] border border-[#b4dc8c]/40">
              <Sparkles className="w-6 h-6" />
            </span>
            스토리보드 마법 주문
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#b4c4a4] hover:text-[#f0e6c0] bg-[#2d5a27]/50 hover:bg-[#2d5a27] border border-[#b4dc8c]/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 relative">
          <Wand2 className="absolute right-4 bottom-4 w-32 h-32 text-[#b4dc8c] opacity-20 pointer-events-none" />

          <p className="text-[#8b7a52] mb-4 text-lg">
            AI 마법사에게 특별히 부탁하고 싶은 이야기의 장르나 분위기가 있다면 자유롭게 적어주세요.
          </p>

          <textarea
            placeholder="예) 해솔이가 신비한 바다 요정을 만나서 용궁을 구하는 판타지 모험으로 그려줘. 활기차고 신나는 분위기였으면 좋겠어!"
            value={prompt}
            onChange={e => onPromptChange(e.target.value)}
            className="w-full h-36 p-5 text-lg text-[#2d5a27] bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-2xl focus:ring-4 focus:ring-[#b4dc8c]/40 focus:border-[#2d5a27] focus:outline-none resize-none relative z-10 leading-relaxed shadow-inner placeholder-[#8b7a52]/60"
          />

          {/* 빠른 태그 */}
          <div className="flex flex-wrap gap-2 mt-4 relative z-10">
            {QUICK_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => appendTag(tag)}
                className="bg-[#f0e6c0] border-2 border-[#b4dc8c] text-[#2d5a27] px-4 py-2 rounded-full text-sm hover:bg-[#2d5a27] hover:text-[#f0e6c0] hover:shadow-[0_0_12px_rgba(180,220,140,0.4)] font-bold transition-all shadow-sm"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-[#2a1b12]/70 border-t border-[#4a3a24] flex justify-end items-center">
          <button
            type="button"
            onClick={onApply}
            className="bg-[#2d5a27] text-[#f0e6c0] px-8 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.5)] hover:bg-[#3d6f34] transition-all font-bold flex items-center gap-2 text-xl"
          >
            마법 주문 적용! <Wand2 className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  )
}
