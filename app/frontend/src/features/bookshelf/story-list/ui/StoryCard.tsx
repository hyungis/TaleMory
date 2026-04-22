import { BookOpen, Mic, Music, Play, Share2, Sparkles, Trash2 } from 'lucide-react'
import type { Story } from '../../../../entities/story'
import { getLevelColor } from '../lib/levelColor'
import { IllustrationMockup } from '../../../../shared/ui'

interface StoryCardProps {
  story: Story
  /** "읽기" 버튼. Task 9(viewer) 에서 실제 뷰어 오픈에 연결. */
  onRead?: (story: Story) => void
  /** 공유 버튼. 추후 shareToken 기반 URL 복사로 연결. */
  onShare?: (story: Story) => void
  /** 삭제 버튼. Task 3b 에서 확인 다이얼로그 + API 연결. */
  onDelete?: (story: Story) => void
  /** 개별 카드 fade-in 딜레이(ms). rowIdx * itemsPerRow + idx 기반으로 상위에서 전달. */
  animationDelayMs?: number
}

/**
 * 빈티지 가죽 장정 스타일의 책 카드.
 *
 * 표지 목업:
 *  - bgClass 그라디언트(실제 책 느낌의 색감)
 *  - 장식용 풍경 SVG (별/산/나무 실루엣)
 *  - 상단 제목 일부 표시
 *  - Sparkles 글로우 효과
 *  - 좌상단: mic/music 배지, 우상단: 페이지 수, 우하단: 난이도 칩
 *  - hover 시 재생 아이콘 오버레이
 */
export function StoryCard({ story, onRead, onShare, onDelete, animationDelayMs = 0 }: StoryCardProps) {
  const BadgeIcon = story.badgeType === 'mic' ? Mic : Music
  const levelColor = getLevelColor(story.level)
  const prettyDate = story.date.replace(/-/g, '.')

  return (
    <div
      className="bookshelf-fade-in book-card bg-[#f0e6c0] rounded-r-xl rounded-l-sm overflow-hidden flex flex-col h-full cursor-pointer relative z-10 border-l-[6px] border-l-[#2a1b12]"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div
        className={`aspect-[3/4] bg-gradient-to-br ${story.bgClass} vintage-cover relative overflow-hidden flex flex-col items-center justify-end border-b border-[#8b7a52]/30 text-[#f0e6c0]/80`}
      >
        {/* 풍경 SVG 목업 — 표지 절반 하단 */}
        <IllustrationMockup
          variant="scenery"
          className="absolute inset-x-0 bottom-0 w-full h-[70%] text-[#f0e6c0]"
        />

        {/* 상단 장식: 큰 Sparkles glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Sparkles className="w-10 h-10 text-[#f0e6c0]/80 book-cover-img transition-transform duration-500" />
        </div>

        {/* 표지 제목 미리보기 */}
        <div className="relative z-10 mb-4 px-4 text-center">
          <p className="text-[11px] uppercase tracking-widest text-[#f0e6c0]/60 mb-1 font-sans">
            TaleMory
          </p>
          <p className="text-sm font-bold leading-tight line-clamp-2 text-[#f0e6c0]">{story.title}</p>
        </div>

        {/* 뱃지들 */}
        <div className="absolute top-3 left-3 bg-[#2d5a27]/95 backdrop-blur-sm text-[#f0e6c0] text-[11px] px-2 py-1 rounded-md font-sans font-bold flex items-center gap-1 shadow-sm z-10">
          <BadgeIcon className="w-3 h-3" />
          {story.badgeText}
        </div>
        <div className="absolute top-3 right-3 bg-black/50 text-[#f0e6c0] text-[10px] px-2 py-1 rounded-md font-sans backdrop-blur-sm flex items-center gap-1 z-10">
          {story.pages} Pages
        </div>
        <div
          className={`absolute bottom-3 right-3 ${levelColor} text-[10px] px-2 py-0.5 rounded font-sans font-bold shadow-sm z-10`}
        >
          {story.level}
        </div>

        {/* hover 오버레이 */}
        <div className="book-cover-overlay absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 transition-opacity duration-300 flex items-center justify-center z-20">
          <div className="bg-[#f0e6c0] text-[#2d5a27] p-4 rounded-full shadow-lg transform hover:scale-110 transition-transform">
            <Play className="w-8 h-8 ml-1" />
          </div>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1 bg-[#f0e6c0] border-b-[5px] border-[#8b7a52]/50">
        <h3 className="text-xl text-[#2d5a27] mb-1 leading-tight line-clamp-2 font-bold">
          {story.title}
        </h3>
        <p className="text-[#8b7a52] text-xs font-sans mb-4 flex-1">
          {prettyDate} • {story.style}
        </p>
        <div className="flex gap-2 mt-auto">
          <button
            type="button"
            onClick={() => onRead?.(story)}
            className="flex-1 bg-[#2d5a27] text-[#f0e6c0] border-2 border-[#b4dc8c] rounded-lg py-2 flex items-center justify-center gap-1 hover:bg-[#3d6f34] hover:shadow-[0_0_12px_rgba(180,220,140,0.5)] transition-all font-bold text-sm"
          >
            <BookOpen className="w-4 h-4" /> 읽기
          </button>
          <button
            type="button"
            onClick={() => onShare?.(story)}
            aria-label="공유"
            className="w-10 h-10 flex items-center justify-center bg-[#8b7a52] text-[#f0e6c0] border-2 border-[#d4b86a] rounded-lg hover:bg-[#a89664] hover:shadow-[0_0_10px_rgba(212,184,106,0.5)] transition-all"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(story)}
            aria-label="삭제"
            className="w-10 h-10 flex items-center justify-center bg-[#8b3a2a] text-[#f0e6c0] border-2 border-[#c97b4a] rounded-lg hover:bg-[#a84a35] hover:shadow-[0_0_10px_rgba(201,123,74,0.5)] transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
