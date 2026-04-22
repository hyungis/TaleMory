import { useState } from 'react'
import { Copy, Share2, CheckCircle2, PartyPopper } from 'lucide-react'
import { StepHeader } from '../../ui/StepHeader'

interface PublishStoryStepProps {
  onBack: () => void
  onExit: () => void
}

/**
 * STEP 08 — 동화책 발행 완료 화면.
 *
 * 현재(Task 8)는 축하 화면 + 가짜 shareToken 발급 + 복사 UX.
 * 실제 백엔드 publish API 호출은 후속 커밋에서 onConfirm 훅으로 주입.
 */
export function PublishStoryStep({ onBack, onExit }: PublishStoryStepProps) {
  const [copied, setCopied] = useState(false)
  const fakeShareToken = 'demo-' + Math.random().toString(36).slice(2, 10)
  const shareUrl = `${window.location.origin}/s/${fakeShareToken}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={8} stepTitle="동화책 발행 완료" onBack={onBack} />
      <div className="bookshelf-scroll">
        <main className="py-12 px-6 bookshelf-fade-in">
          <div className="max-w-2xl mx-auto bg-[#f0e6c0] p-8 md:p-12 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-2 border-[#2a1b12] text-center">
            <div className="w-20 h-20 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-5 border-2 border-[#b4dc8c] shadow-[0_0_25px_rgba(180,220,140,0.5)]">
              <PartyPopper className="w-10 h-10 text-[#f0e6c0]" />
            </div>
            <h2 className="text-3xl text-[#2d5a27] font-bold mb-2">동화책이 완성됐어요!</h2>
            <p className="text-[#8b7a52] mb-8">아래 링크를 공유하면 가족이 함께 볼 수 있어요.</p>

            <div className="bg-[#e8ddb4] border-2 border-[#8b7a52]/50 rounded-xl p-4 mb-6 flex items-center gap-3">
              <code className="flex-1 text-sm text-[#2d5a27] text-left truncate">{shareUrl}</code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 bg-[#2d5a27] text-[#f0e6c0] px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 hover:bg-[#3d6f34] transition-colors"
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>

            <p className="text-xs text-[#8b7a52] mb-8">
              TODO(S14P31S210-76): 실제 publish API 연동 후 실제 shareToken 반환값을 사용하도록 변경.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() =>
                  navigator.share?.({ url: shareUrl, title: '우리 가족 동화책' }).catch(() => {})
                }
                className="bg-[#8b7a52] text-[#f0e6c0] px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-[#a89664] transition-colors"
              >
                <Share2 className="w-4 h-4" /> 공유
              </button>
              <button
                type="button"
                onClick={onExit}
                className="bg-[#2d5a27] text-[#f0e6c0] px-8 py-3 rounded-full font-bold border border-[#b4dc8c]/40 hover:bg-[#3d6f34] transition-colors"
              >
                책장으로 가기
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
