import { BookOpen, ScrollText, ExternalLink } from 'lucide-react'
import type { StoryView } from '../../model/types'

interface InvitationCardProps {
  story: StoryView
  isOwner: boolean
  onOpenBook: () => void
  onOpenWebtoon: () => void
}

/**
 * 뷰어 진입 청첩장 카드.
 * 커버 이미지 + 두 모드 선택 버튼(동화책 / 웹툰)만 노출.
 * 링크 복사/공유는 책장 화면에서 제공하므로 여기선 중복 제거.
 * props 의 `story` / `isOwner` 는 향후 shareToken 라우트 재사용 대비로 유지.
 */
export function InvitationCard({ story: _story, isOwner: _isOwner, onOpenBook, onOpenWebtoon }: InvitationCardProps) {
  return (
    <section className="h-full overflow-y-auto bg-[#0a1a0a] py-8 md:py-14 px-4 text-[#f0e6c0]">
      <div className="max-w-2xl mx-auto">
        <article className="relative rounded-[2.5rem] border-[3px] border-[#b4dc8c]/50 bg-gradient-to-br from-[#1a2414] to-[#2a1f14] p-6 md:p-10 shadow-[0_8px_0_rgba(45,90,39,0.3)] overflow-hidden">
          {/* 커버 일러스트 */}
          <div className="relative aspect-[4/3] rounded-[1.75rem] mb-8 overflow-hidden border-[3px] border-[#f0e6c0] bg-gradient-to-br from-[#2d5a27] via-[#3d6f34] to-[#8b7a52] flex items-center justify-center">
            <div className="text-center px-6">
              <BookOpen
                className="w-20 h-20 md:w-24 md:h-24 mx-auto text-[#f0e6c0] drop-shadow-lg mb-3"
                strokeWidth={1.5}
              />
              <p className="text-[#f0e6c0]/95 text-sm md:text-base drop-shadow font-bold">
                A Storybook by TaleMory
              </p>
            </div>
          </div>

          {/* 모드 선택 */}
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
        </article>
      </div>
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
      <span
        aria-hidden
        className="pointer-events-none absolute -top-5 -right-5 w-20 h-20 bg-[#2d5a27]/40 rounded-full"
      />
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
