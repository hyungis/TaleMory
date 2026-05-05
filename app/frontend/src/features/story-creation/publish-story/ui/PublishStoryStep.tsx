import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Share2, CheckCircle2, PartyPopper, Loader2, Library, Maximize, Home } from 'lucide-react'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
import { publishStory, getShareLink } from '../../../bookshelf'
import { ROUTES } from '../../../../shared/constants'
import '../../styles/creation-paper.css'

interface PublishStoryStepProps {
  storyId: number | null
  onBack: () => void
  /** "내 책장 보관하기" — publish 완료 후 책장으로 이동. */
  onSaveToBookshelf: () => void
  /** "뷰어로 열기" — publish 완료 후 풀스크린 뷰어로 이동. */
  onOpenViewer: () => void
}

/**
 * STEP 09 — paper-craft 톤. 동화책 발행 + 공유 링크.
 */
export function PublishStoryStep({ storyId, onBack, onSaveToBookshelf, onOpenViewer }: PublishStoryStepProps) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* BE 가 주는 shareUrl 은 상대경로(/shared/...) 라 그대로 두면 표시·복사·공유 모두
     상대경로로 나간다. 책장(BookstoreScene) 처럼 origin 을 prefix 해서 full URL 로 변환.
     SSR 환경 대비 window 가용성 가드. */
  const fullShareUrl = useMemo(() => {
    if (!shareUrl) return null
    if (typeof window === 'undefined') return shareUrl
    return shareUrl.startsWith('http') ? shareUrl : `${window.location.origin}${shareUrl}`
  }, [shareUrl])

  /* Step 8 → Step 9 진입 시 사용자가 따로 "발행하기" 버튼을 누르지 않아도 바로 발행이
     시작되도록 자동 트리거. 흐름:
       1) getShareLink → 이미 발행된 동화면 기존 링크 그대로 사용 (멱등 진입)
       2) getShareLink 실패 = 미발행 → 즉시 publishStory 호출
       3) 둘 다 실패 → error state → 사용자가 재시도 버튼 클릭 가능
     BE `publishStory` 도 PUBLISHED 상태에 멱등(StoryService:183~188) 이라 race 상황에서
     이중 호출이 되어도 안전. publishing 상태는 두 단계 모두를 커버해 사용자에게 "발행 중"
     스피너를 끊김없이 보여줌. */
  useEffect(() => {
    if (!storyId) {
      // 정상 플로우에선 발생 안 함 — 비정상 진입(직접 URL/state 잃음) 시 명확한 안내.
      setError('동화 정보를 찾을 수 없어요. 처음부터 다시 시작해주세요.')
      setPublishing(false)
      return
    }
    let cancelled = false
    setPublishing(true)
    setError(null)

    const run = async () => {
      try {
        const existing = await getShareLink(storyId)
        if (cancelled) return
        setShareUrl(existing.shareUrl)
        setPublished(true)
      } catch {
        if (cancelled) return
        try {
          const data = await publishStory(storyId)
          if (cancelled) return
          setShareUrl(data.shareUrl)
          setPublished(true)
        } catch {
          if (cancelled) return
          setError('발행에 실패했어요. 다시 시도해주세요.')
        }
      } finally {
        if (!cancelled) setPublishing(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [storyId])

  /** 자동 발행 실패 시 수동 재시도 핸들러. */
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
    if (!fullShareUrl) return
    try {
      await navigator.clipboard.writeText(fullShareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [fullShareUrl])

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
                    {fullShareUrl}
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

                {/* publish 완료 후 3개 액션 (Step 8 에서 옮김 — 이제는 모두 실제 동작) */}
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 14,
                  }}
                >
                  <button
                    type="button"
                    onClick={onSaveToBookshelf}
                    className="cr-btn-back"
                    style={{ justifySelf: 'auto', padding: '14px 24px', fontSize: 17 }}
                  >
                    <Library className="w-5 h-5" /> 내 책장 보관하기
                  </button>
                  <button
                    type="button"
                    onClick={onOpenViewer}
                    className="cr-btn-next"
                    style={{ justifySelf: 'auto', padding: '14px 24px', fontSize: 17 }}
                  >
                    <Maximize className="w-5 h-5" /> 뷰어로 열기
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.share
                        ?.({ url: fullShareUrl ?? undefined, title: '우리 가족 동화책' })
                        .catch(() => {})
                    }
                    style={{
                      background: 'var(--cr-rust)',
                      color: '#fdf6dc',
                      border: '2px solid #8a4a32',
                      borderRadius: 999,
                      padding: '14px 24px',
                      fontFamily: 'var(--cr-font-serif)',
                      fontWeight: 700,
                      fontSize: 17,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 3px 0 #8a4a32, 0 6px 14px rgba(140,60,40,0.25)',
                    }}
                  >
                    <Share2 className="w-5 h-5" /> 링크 공유하기
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* 비정상 진입 (storyId 유실) → "메인으로" 명확한 액션 제공.
                    정상 플로우엔 발생 안 하지만 직접 URL/state 잃은 경우 사용자가 막히지 않도록. */}
                {!storyId ? (
                  <>
                    <h2
                      style={{
                        fontFamily: 'var(--cr-font-serif)',
                        fontWeight: 800,
                        fontSize: 28,
                        color: 'var(--cr-ink)',
                        margin: '0 0 8px',
                        letterSpacing: '-0.5px',
                      }}
                    >
                      동화 정보를 찾을 수 없어요
                    </h2>
                    <p
                      style={{
                        fontFamily: 'var(--cr-font-gaegu)',
                        fontSize: 17,
                        color: 'var(--cr-ink-soft)',
                        margin: '0 0 28px',
                        lineHeight: 1.5,
                      }}
                    >
                      처음부터 다시 시작해주세요.
                      <br />
                      메인 페이지에서 새 동화책 만들기를 눌러주세요.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.main)}
                      className="cr-big-cta"
                      style={{ width: 'auto', display: 'inline-flex', minWidth: 200 }}
                    >
                      <Home className="w-5 h-5" />
                      <span>메인으로 돌아가기</span>
                    </button>
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
                      {publishing ? '동화책을 발행하는 중...' : '발행을 다시 시도해주세요'}
                    </h2>
                    <p
                      style={{
                        fontFamily: 'var(--cr-font-gaegu)',
                        fontSize: 17,
                        color: 'var(--cr-ink-soft)',
                        margin: '0 0 28px',
                      }}
                    >
                      {publishing
                        ? '잠시만 기다려주세요. 발행이 끝나면 공유 링크가 자동으로 나타나요.'
                        : '아래 버튼을 눌러 다시 발행해주세요.'}
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

                    {/* 진행 중엔 스피너만, 실패 후엔 재시도 버튼 노출 */}
                    {publishing ? (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '14px 28px',
                          background: 'var(--cr-paper)',
                          border: '2px solid var(--cr-caramel-deep)',
                          borderRadius: 999,
                          color: 'var(--cr-ink-soft)',
                          fontFamily: 'var(--cr-font-gaegu)',
                          fontWeight: 700,
                          fontSize: 16,
                          boxShadow: '0 2px 0 var(--cr-caramel-deep)',
                        }}
                      >
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--cr-sage-deep)' }} />
                        <span>발행 중...</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePublish}
                        className="cr-big-cta"
                        style={{ width: 'auto', display: 'inline-flex', minWidth: 240 }}
                      >
                        <PartyPopper className="w-5 h-5" />
                        <span>다시 발행하기</span>
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* 발행을 트리거한 시점부터 이전 단계로 돌아갈 수 없도록 backDisabled.
          이전 단계(편집/재생성) 는 DRAFT 상태 전제라 PUBLISHED 가 된 동화는 다시 갈 이유 없음. */}
      <CreationFooter currentStep={9} onBack={onBack} backDisabled />
    </div>
  )
}
