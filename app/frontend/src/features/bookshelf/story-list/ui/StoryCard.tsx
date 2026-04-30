import { BookOpen, Share2, Trash2 } from 'lucide-react'
import type { Story } from '../../../../entities/story'
import { getLevelColor } from '../lib/levelColor'

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
  const levelColor = getLevelColor(story.level)
  // TODO: BE 가 coverImageUrl 응답 필드 추가하면 story.coverImageUrl 로 교체.
  // 임시로 picsum.photos 의 seed 기반 placeholder — story.id 마다 다른 이미지가 나옴.
  const previewCoverUrl = `https://picsum.photos/seed/talemory-${story.id}/400/600`

  return (
    <div
      className="bookshelf-fade-in book-card bg-[#F2EBD2] rounded-r-xl rounded-l-sm overflow-hidden flex flex-col h-full cursor-pointer relative z-10 border-l-[6px] border-l-[#6B4A28]"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div
        className={`aspect-[3/4] bg-gradient-to-br ${story.bgClass} vintage-cover relative overflow-hidden flex flex-col items-center justify-end text-[#F2EBD2]/80`}
      >
        {/* 표지 이미지 — placeholder (추후 story.coverImageUrl 로 교체) */}
        <img
          src={previewCoverUrl}
          alt={story.title}
          className="absolute inset-0 w-full h-full object-cover book-cover-img transition-transform duration-500"
          draggable={false}
        />

        {/* 가독성용 어두운 vignette — 상하단 어둡게 해서 제목/뱃지 글자 잘 보이게 */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/75 pointer-events-none" />

        {/* 표지 제목 — vignette 위에 흰색으로 노출 */}
        <div className="relative z-10 mb-4 px-4 text-center">
          <p className="text-base font-bold leading-tight line-clamp-2 text-[#F2EBD2] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{story.title}</p>
        </div>

        {/* 뱃지들 — 좌상단: 레벨(초급/중급/고급), 우상단: 페이지 수 */}
        <div className={`absolute top-3 left-3 ${levelColor} text-[11px] px-2 py-1 rounded-md font-sans font-bold shadow-sm z-10`}>
          {story.level}
        </div>
        <div className="absolute top-3 right-3 bg-black/50 text-[#F2EBD2] text-[10px] px-2 py-1 rounded-md font-sans backdrop-blur-sm flex items-center gap-1 z-10">
          {story.pages} Pages
        </div>

        {/* hover 오버레이 — 마우스 가져다 대면 3개 액션 버튼이 표지 위에 등장 */}
        <div className="book-cover-overlay absolute inset-0 bg-black/55 backdrop-blur-[2px] opacity-0 transition-opacity duration-300 flex items-center justify-center gap-2 px-3 z-20">
          <button
            type="button"
            onClick={() => onRead?.(story)}
            className="flex-1 bg-[#8DBA64] text-[#1F3318] border-2 border-[#B9D38F] rounded-lg py-2 flex items-center justify-center gap-1 hover:bg-[#A6CB45] hover:shadow-[0_0_12px_rgba(141,186,100,0.5)] transition-all font-bold text-sm"
          >
            <BookOpen className="w-4 h-4" /> 읽기
          </button>
          <button
            type="button"
            onClick={() => onShare?.(story)}
            aria-label="공유"
            className="w-10 h-10 flex items-center justify-center bg-[#C9A874] text-[#3E2A18] border-2 border-[#E9DBBE] rounded-lg hover:bg-[#D9BE82] hover:shadow-[0_0_10px_rgba(217,190,130,0.5)] transition-all"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(story)}
            aria-label="삭제"
            className="w-10 h-10 flex items-center justify-center bg-[#D8857C] text-[#3E2A18] border-2 border-[#E2BFB9] rounded-lg hover:bg-[#E2BFB9] hover:shadow-[0_0_10px_rgba(216,133,124,0.5)] transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
