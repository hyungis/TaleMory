import { useCallback, useEffect, useState } from 'react'
import { Copy, Share2, CheckCircle2, PartyPopper, Loader2 } from 'lucide-react'
import { StepHeader } from '../../ui/StepHeader'
import { publishStory, getShareLink } from '../../../bookshelf'

interface PublishStoryStepProps {
  storyId: number | null
  onBack: () => void
  onExit: () => void
}

/**
 * STEP 09 — 동화책 발행 완료 화면.
 *
 * storyId 가 있으면 publish API 를 호출하고, 성공 시 shareUrl 을 표시한다.
 */
export function PublishStoryStep({ storyId, onBack, onExit }: PublishStoryStepProps) {
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!storyId) return
    // 이미 발행된 동화라면 share-link 조회 시도
    getShareLink(storyId)
      .then(data => {
        setShareUrl(data.shareUrl)
        setPublished(true)
      })
      .catch(() => {
        // 아직 미발행 상태 — 정상
      })
  }, [storyId])

  const handlePublish = useCallback(async () => {
    if (!storyId || publishing) return
    setPublishing(true)
    setError(null)
    try {
      const data = await publishStory(storyId)
      setShareUrl(data.shareUrl)
      setPublished(true)
    } catch {
      setError('발행에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setPublishing(false)
    }
  }, [storyId, publishing])

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [shareUrl])

  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={9} stepTitle="동화책 발행" onBack={onBack} />
      <div className="bookshelf-scroll">
        <main className="py-12 px-6 bookshelf-fade-in">
          <div className="max-w-2xl mx-auto bg-[#f0e6c0] p-8 md:p-12 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-2 border-[#2a1b12] text-center">
            <div className="w-20 h-20 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-5 border-2 border-[#b4dc8c] shadow-[0_0_25px_rgba(180,220,140,0.5)]">
              <PartyPopper className="w-10 h-10 text-[#f0e6c0]" />
            </div>

            {published && shareUrl ? (
              <>
                <h2 className="text-3xl text-[#2d5a27] font-bold mb-2">동화책이 완성됐어요!</h2>
                <p className="text-[#8b7a52] mb-8">
                  아래 링크를 공유하면 가족이 함께 볼 수 있어요.
                </p>

                <div className="bg-[#e8ddb4] border-2 border-[#8b7a52]/50 rounded-xl p-4 mb-6 flex items-center gap-3">
                  <code className="flex-1 text-sm text-[#2d5a27] text-left truncate">
                    {shareUrl}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 bg-[#2d5a27] text-[#f0e6c0] px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 hover:bg-[#3d6f34] transition-colors"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>

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
              </>
            ) : (
              <>
                <h2 className="text-3xl text-[#2d5a27] font-bold mb-2">동화책을 발행할까요?</h2>
                <p className="text-[#8b7a52] mb-8">
                  발행하면 공유 링크가 생성되어 가족에게 보낼 수 있어요.
                </p>

                {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing || !storyId}
                  className="bg-[#2d5a27] text-[#f0e6c0] px-10 py-4 rounded-full text-xl font-bold border border-[#b4dc8c]/40 shadow-[0_6px_0_#1a3a14] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14] hover:bg-[#3d6f34] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                  {publishing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <PartyPopper className="w-6 h-6" />
                  )}
                  {publishing ? '발행 중...' : '발행하기'}
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
