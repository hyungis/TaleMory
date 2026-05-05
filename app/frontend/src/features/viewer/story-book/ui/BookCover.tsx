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
          className="sb-cover-illust"
        />
      ) : (
        <BookOpen
          className="sb-cover-icon"
          strokeWidth={1.5}
        />
      )}

      <div className="sb-cover-text">
        <div className="sb-cover-badge">
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
