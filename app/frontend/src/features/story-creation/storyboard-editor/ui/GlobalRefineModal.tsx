import { useState } from 'react'
import { RefreshCcw, Sparkles, Wand2, X } from 'lucide-react'
import { MAX_GLOBAL_REFINE } from '../lib/defaults'

interface GlobalRefineModalProps {
  isOpen: boolean
  remaining: number
  onClose: () => void
  /** 입력값을 훅의 submit 으로 전달. submit 성공 여부 반환. */
  onSubmit: (prompt: string) => boolean
}

/**
 * "AI에게 전체 수정 요청" 모달. Step 4 상단의 요청 버튼에서 오픈.
 */
export function GlobalRefineModal({ isOpen, remaining, onClose, onSubmit }: GlobalRefineModalProps) {
  const [prompt, setPrompt] = useState('')

  if (!isOpen) return null

  const handleSubmit = () => {
    const ok = onSubmit(prompt)
    if (ok) setPrompt('')
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center bookshelf-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#f0e6c0] rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)] border-2 border-[#2a1b12] max-w-xl w-[92%] p-8 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-4 right-4 text-[#8b7a52] hover:text-[#2d5a27] bg-[#e8ddb4] w-10 h-10 rounded-full border-2 border-[#8b7a52]/40 flex items-center justify-center hover:bg-[#b4dc8c] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#2d5a27] p-3 rounded-full border border-[#b4dc8c]/50">
            <Wand2 className="w-6 h-6 text-[#f0e6c0]" />
          </div>
          <h2 className="text-2xl md:text-3xl text-[#2d5a27] font-bold">AI에게 전체 수정 요청</h2>
        </div>

        <p className="text-[#8b7a52] text-lg mb-3">
          전체 스토리보드에 대해 어떻게 수정하고 싶은지 알려주세요.
          <br />
          AI가 모든 페이지를 한번에 다듬어 드려요.
        </p>

        <div className="flex items-center gap-2 bg-[#e8ddb4] border border-[#8b7a52]/40 px-4 py-2 rounded-full text-sm mb-5 w-fit">
          <RefreshCcw className="w-4 h-4 text-[#2d5a27]" />
          <span className="text-[#8b7a52]">전체 수정 가능 횟수</span>
          <span className="text-[#2d5a27] font-bold">
            {remaining} / {MAX_GLOBAL_REFINE} 남음
          </span>
        </div>

        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={5}
          placeholder="예) 조금 더 따뜻하고 감성적인 말투로 바꿔주세요. 아이의 시점에서 이야기해 주세요."
          className="w-full p-5 rounded-2xl border-2 border-[#8b7a52]/60 bg-[#e8ddb4] text-[#2d5a27] text-lg font-sans focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/40 resize-none placeholder-[#8b7a52]/60"
        />

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="text-[#8b7a52] hover:text-[#2d5a27] bg-[#f0e6c0] border-2 border-[#8b7a52]/40 px-6 py-3 rounded-full font-bold text-lg"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={remaining <= 0}
            className="bg-[#2d5a27] text-[#f0e6c0] px-8 py-3 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14] hover:translate-y-0.5 hover:shadow-[0_2px_0_#1a3a14] hover:bg-[#3d6f34] transition-all font-bold text-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <Sparkles className="w-5 h-5" /> 수정 요청하기
          </button>
        </div>
      </div>
    </div>
  )
}
