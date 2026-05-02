import { useCallback, useEffect, useState } from 'react'
import { Copy, Share2, CheckCircle2, PartyPopper, Loader2 } from 'lucide-react'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
import { publishStory, getShareLink } from '../../../bookshelf'
import '../../styles/creation-paper.css'

interface PublishStoryStepProps {
  storyId: number | null
  onBack: () => void
  onExit: () => void
}

/**
 * STEP 09 — paper-craft 톤. 동화책 발행 + 공유 링크.
 */
export function PublishStoryStep({ storyId, onBack, onExit }: PublishStoryStepProps) {
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!storyId) return
    getShareLink(storyId)
      .then(data => {
        setShareUrl(data.shareUrl)
        setPublished(true)
      })
      .catch(() => {})
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
      setError('발행에 실패했어요. 다시 시도해주세요.')
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
    } catch {}
  }, [shareUrl])

  return (
    <div className="cr-shell">
      <CreationDoodlesBg />
      <CreationHeader currentStep={9} />
      <div className="cr-scroll">
        <main className="cr-shell-inner cr-fade-in" style={{ maxWidth: 640 }}>
          <div
            className="cr-card"
            style={{
              padding: '40px 32px',
              textAlign: 'center',
            }}
          >
            <span className="cr-tape" aria-hidden="true" />

            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                background: 'var(--cr-sage-darker)',
                color: '#fdf6dc',
                display: 'inline-grid',
                placeItems: 'center',
                margin: '0 auto 20px',
                border: '3px solid var(--cr-sage)',
                boxShadow: '0 4px 0 #2a3f1f, 0 8px 18px rgba(63,92,48,0.3)',
              }}
            >
              <PartyPopper className="w-10 h-10" />
            </div>

            {published && shareUrl ? (
              <>
                <h2
                  style={{
                    fontFamily: 'var(--cr-font-serif)',
                    fontWeight: 800,
                    fontSize: 32,
                    color: 'var(--cr-ink)',
                    margin: '0 0 8px',
                    letterSpacing: '-0.5px',
                  }}
                >
                  동화책이 완성됐어요!
                </h2>
                <p
                  style={{
                    fontFamily: 'var(--cr-font-gaegu)',
                    fontSize: 17,
                    color: 'var(--cr-ink-soft)',
                    margin: '0 0 28px',
                  }}
                >
                  아래 링크를 공유하면 가족이 함께 볼 수 있어요.
                </p>

                <div
                  style={{
                    background: '#fdf6dc',
                    border: '2px dashed var(--cr-caramel)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    marginBottom: 24,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <code
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: 'var(--cr-ink)',
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {shareUrl}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      background: 'var(--cr-sage)',
                      color: '#fdf6dc',
                      border: '2px solid var(--cr-sage-deep)',
                      borderRadius: 999,
                      padding: '6px 14px',
                      fontFamily: 'var(--cr-font-gaegu)',
                      fontWeight: 700,
                      fontSize: 14,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      boxShadow: '0 2px 0 var(--cr-sage-deep)',
                      flexShrink: 0,
                    }}
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.share
                        ?.({ url: shareUrl, title: '우리 가족 동화책' })
                        .catch(() => {})
                    }
                    className="cr-btn-back"
                    style={{ justifySelf: 'auto' }}
                  >
                    <Share2 className="w-4 h-4" /> 공유
                  </button>
                  <button type="button" onClick={onExit} className="cr-btn-next" style={{ justifySelf: 'auto' }}>
                    <span>책장으로 가기</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2
                  style={{
                    fontFamily: 'var(--cr-font-serif)',
                    fontWeight: 800,
                    fontSize: 32,
                    color: 'var(--cr-ink)',
                    margin: '0 0 8px',
                    letterSpacing: '-0.5px',
                  }}
                >
                  동화책을 발행할까요?
                </h2>
                <p
                  style={{
                    fontFamily: 'var(--cr-font-gaegu)',
                    fontSize: 17,
                    color: 'var(--cr-ink-soft)',
                    margin: '0 0 28px',
                  }}
                >
                  발행하면 공유 링크가 생성되어 가족에게 보낼 수 있어요.
                </p>

                {error && (
                  <p
                    style={{
                      fontFamily: 'var(--cr-font-gaegu)',
                      fontSize: 14,
                      color: 'var(--cr-rust)',
                      marginBottom: 14,
                    }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing || !storyId}
                  className="cr-big-cta"
                  style={{ width: 'auto', display: 'inline-flex', minWidth: 240 }}
                >
                  {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PartyPopper className="w-5 h-5" />}
                  <span>{publishing ? '발행 중...' : '발행하기'}</span>
                </button>
              </>
            )}
          </div>
        </main>
      </div>

      <CreationFooter currentStep={9} onBack={onBack} />
    </div>
  )
}
