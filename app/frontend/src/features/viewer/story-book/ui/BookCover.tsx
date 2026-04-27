import { BookOpen, ChevronRight, Sparkles } from 'lucide-react'

interface BookCoverProps {
  title: string
  subtitle?: string
  authorLabel: string
  illustrationUrl: string | null
}

/** 동화책 앞표지 (단면). 책등은 부모에서 `.sb-spine` 으로 삽입. */
export function BookCover({ title, subtitle, authorLabel, illustrationUrl }: BookCoverProps) {
  return (
    <div className="sb-cover-single">
      {illustrationUrl ? (
        <img
          src={illustrationUrl}
          alt=""
          className="relative z-[3] mb-3 w-[110px] h-[110px] object-cover rounded-full border-[3px] border-white shadow-lg"
        />
      ) : (
        <BookOpen
          className="relative z-[3] mb-3 w-[110px] h-[110px] drop-shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
          style={{ color: 'rgba(255,255,255,0.95)' }}
          strokeWidth={1.5}
        />
      )}

      <div className="relative z-[3] text-center max-w-[80%]">
        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white/95 border-2 border-white rounded-full text-[#4e7c1f] text-sm mb-4 font-bold shadow">
          <Sparkles className="w-4 h-4" />
          <span>TaleMory Storybook</span>
          <Sparkles className="w-4 h-4" />
        </div>
        {subtitle && <p className="sb-cover-subtitle">{subtitle}</p>}
        <h1 className="sb-cover-title">{title}</h1>
        <p className="sb-cover-author">{authorLabel}</p>
      </div>

      <p className="sb-cover-hint">
        <ChevronRight className="w-4 h-4" />
        책장을 넘겨 시작하세요
      </p>
    </div>
  )
}
