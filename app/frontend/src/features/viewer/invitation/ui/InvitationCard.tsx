import { useState } from 'react'
import { Link2, Share2, BookOpen, ScrollText, ExternalLink, Sparkles, Mail, Quote } from 'lucide-react'
import type { StoryView } from '../../model/types'

interface InvitationCardProps {
  story: StoryView
  isOwner: boolean
  onOpenBook: () => void
  onOpenWebtoon: () => void
}

/**
 * 뷰어 진입 청첩장 카드.
 * 작성자 본인이면 하단 공유 버튼 표시, 공유 링크 받은 사람이면 숨김.
 *
 * 현재는 `isOwner=true` 경로만 실제로 쓰이고, shareToken 기반 공개 라우트가 추가될 때
 * 동일 컴포넌트를 `isOwner=false` 로 재사용한다.
 */
export function InvitationCard({ story, isOwner, onOpenBook, onOpenWebtoon }: InvitationCardProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const authorName = story.mainCharacter?.name ? `${story.mainCharacter.name}의 가족` : '우리 가족'
  const pageCount = story.scenes.length

  const copyShareLink = async () => {
    // 실제 공유 URL 생성은 #61 GET /api/stories/{storyId}/share-link 로직 완성 후 연결.
    const url = window.location.origin + window.location.pathname
    try {
      await navigator.clipboard.writeText(url)
      showToast('링크가 복사되었어요')
    } catch {
      showToast('링크 복사에 실패했어요')
    }
  }

  const shareNative = async () => {
    const url = window.location.origin + window.location.pathname
    if (navigator.share) {
      try {
        await navigator.share({
          title: story.title ?? '우리 가족 동화책',
          text: `${authorName}이 만든 동화책을 함께 읽어보세요`,
          url,
        })
      } catch {
        /* 사용자가 공유 취소한 경우 무시 */
      }
    } else {
      copyShareLink()
    }
  }

  const showToast = (message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2000)
  }

  return (
    <section className="min-h-screen bg-[#0a1a0a] py-8 md:py-14 px-4 text-[#f0e6c0]">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#1a2414] border-2 border-[#b4dc8c]/60 text-[#b4dc8c] text-sm font-bold">
            <Mail className="w-4 h-4" />
            <span>{authorName}이 동화책을 보냈어요</span>
          </div>
        </div>

        <article className="relative rounded-[2.5rem] border-[3px] border-[#b4dc8c]/50 bg-gradient-to-br from-[#1a2414] to-[#2a1f14] p-6 md:p-10 shadow-[0_8px_0_rgba(45,90,39,0.3)] overflow-hidden">
          {/* 외곽 점선 프레임 */}
          <span aria-hidden className="pointer-events-none absolute inset-[14px] rounded-[1.7rem] border-2 border-dashed border-[#b4dc8c]/25" />

          {/* 커버 일러스트 영역 */}
          <div className="relative aspect-[4/3] rounded-[1.75rem] mb-7 overflow-hidden border-[3px] border-[#f0e6c0] bg-gradient-to-br from-[#2d5a27] via-[#3d6f34] to-[#8b7a52] flex items-center justify-center">
            <div className="text-center px-6">
              <BookOpen className="w-20 h-20 md:w-24 md:h-24 mx-auto text-[#f0e6c0] drop-shadow-lg mb-3" strokeWidth={1.5} />
              <p className="text-[#f0e6c0]/95 text-sm md:text-base drop-shadow font-bold">A Storybook by TaleMory</p>
            </div>
          </div>

          {/* 제목 */}
          <div className="text-center mb-8">
            <p className="text-[#b4dc8c] text-sm md:text-base mb-2">우리 가족의 이야기를 들려드릴게요</p>
            <h1 className="text-3xl md:text-5xl font-bold text-[#f0e6c0] mb-4 leading-tight">{story.title ?? '제목 없는 동화'}</h1>
            <div className="flex items-center justify-center gap-2 text-[#8b7a52] text-sm">
              <span className="w-8 h-px bg-[#b4dc8c]/60" />
              <Sparkles className="w-4 h-4 text-[#b4dc8c]" />
              <span>총 {pageCount}페이지의 따뜻한 동화</span>
              <Sparkles className="w-4 h-4 text-[#b4dc8c]" />
              <span className="w-8 h-px bg-[#b4dc8c]/60" />
            </div>
          </div>

          {/* 소개 메시지 */}
          <div className="rounded-[2rem] bg-[#0f1a0c]/60 border-[3px] border-[#b4dc8c]/40 p-5 md:p-6 mb-8">
            <div className="flex items-start gap-3">
              <Quote className="w-6 h-6 text-[#b4dc8c] shrink-0 mt-1" strokeWidth={2.5} />
              <p className="text-[#f0e6c0] text-base md:text-lg leading-relaxed">
                {authorName}의 이야기를 동화책으로 담아보았어요. 반짝이는 눈으로 세상을 바라보던 그 순간을 함께 읽어주세요.
              </p>
            </div>
            <p className="text-right text-[#8b7a52] text-sm mt-3">— {authorName} 드림 🌳</p>
          </div>

          {/* 모드 선택 */}
          <div>
            <p className="text-center text-[#8b7a52] text-sm mb-4">🌿 원하는 방식으로 동화책을 열어보세요 🌿</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ModeCard
                icon={<BookOpen className="w-7 h-7 text-[#b4dc8c]" strokeWidth={2.5} />}
                title="동화책 모드"
                description="한 페이지씩 넘기며 읽어요"
                onClick={onOpenBook}
              />
              <ModeCard
                icon={<ScrollText className="w-7 h-7 text-[#b4dc8c]" strokeWidth={2.5} />}
                title="웹툰 모드"
                description="세로로 스크롤하며 읽어요"
                onClick={onOpenWebtoon}
              />
            </div>
          </div>
        </article>

        {/* 공유 버튼 — 작성자 본인에게만 */}
        {isOwner && (
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={copyShareLink}
              className="flex-1 rounded-full px-5 py-3 bg-[#1a2414] border-2 border-[#b4dc8c]/50 hover:bg-[#2d5a27]/60 transition-colors flex items-center justify-center gap-2"
            >
              <Link2 className="w-4 h-4 text-[#b4dc8c]" />
              <span className="text-sm">링크 복사하기</span>
            </button>
            <button
              onClick={shareNative}
              className="flex-1 rounded-full px-5 py-3 bg-[#1a2414] border-2 border-[#b4dc8c]/50 hover:bg-[#2d5a27]/60 transition-colors flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4 text-[#b4dc8c]" />
              <span className="text-sm">친구에게 공유</span>
            </button>
          </div>
        )}

        <div className="text-center mt-8 text-[#8b7a52] text-xs">
          <p>© TaleMory</p>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#2d5a27] text-[#f0e6c0] px-6 py-3 rounded-full shadow-[0_10px_25px_rgba(0,0,0,0.4)] text-sm font-bold z-50"
        >
          {toastMessage}
        </div>
      )}
    </section>
  )
}

interface ModeCardProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}

function ModeCard({ icon, title, description, onClick }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative bg-[#1a2414] border-[3px] border-[#b4dc8c]/40 hover:border-[#b4dc8c] hover:-translate-y-1 hover:shadow-[0_10px_0_rgba(45,90,39,0.4)] transition-all rounded-[1.75rem] p-5 text-center overflow-hidden"
    >
      <span aria-hidden className="pointer-events-none absolute -top-5 -right-5 w-20 h-20 bg-[#2d5a27]/40 rounded-full" />
      <span className="relative block w-16 h-16 rounded-[1.4rem] bg-gradient-to-br from-[#0f1a0c] to-[#2d5a27] border-2 border-[#b4dc8c]/60 mx-auto mb-3 flex items-center justify-center shadow-[0_4px_0_rgba(45,90,39,0.4)]">
        {icon}
      </span>
      <h3 className="text-lg md:text-xl font-bold mb-1 text-[#f0e6c0]">{title}</h3>
      <p className="text-[#8b7a52] text-xs md:text-sm">{description}</p>
      <p className="text-[#b4dc8c] text-xs mt-2 flex items-center justify-center gap-1 font-bold">
        <ExternalLink className="w-3 h-3" />
        지금 열기
      </p>
    </button>
  )
}
