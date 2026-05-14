import type { StoryView } from '../../model/types'
import '../styles/invitation.css'

interface InvitationCardProps {
  story: StoryView
  isOwner: boolean
  onOpen: () => void
}

/**
 * 공유 링크 진입 화면 — 온라인 청첩장 스타일.
 * 동화 표지 카드(제목, 작가, 페이지 수/날짜/난이도) + "읽어보기" CTA.
 */
export function InvitationCard({
  story,
  onOpen,
}: InvitationCardProps) {
  const title = story.title?.trim() || '제목 없는 동화'
  const pageCount = story.scenes.length
  const publishedAtLabel = formatPublishedAtLabel(story.publishedAt)
  const difficultyLabel = formatDifficultyLabel(story.difficulty)
  const isWebtoon = story.mode === 'WEBTOON'
  const modeLabel = isWebtoon ? '웹툰' : '동화책'

  return (
    <section className="iv-shell">
      <div className="iv-bg-base" aria-hidden="true" />
      <div className="iv-bg-grain" aria-hidden="true" />
      <div className="iv-bg-crayon" aria-hidden="true" />

      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="iv-crayon-rough" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={3} />
            <feDisplacementMap in="SourceGraphic" scale="1.2" />
          </filter>
        </defs>
      </svg>

      <div className="iv-doodles" aria-hidden="true">
        <svg className="iv-d-cloud" viewBox="0 0 80 50">
          <path d="M14,34 C8,34 4,30 4,24 C4,18 9,15 14,16 C16,10 22,8 27,11 C30,7 38,6 42,11 C48,8 56,12 56,20 C62,20 66,24 66,30 C66,34 62,38 56,38 L18,38 C16,38 14,36 14,34 Z" stroke="#a37548" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="iv-d-star" viewBox="0 0 40 40">
          <path d="M20,4 L24,16 L36,18 L27,26 L30,38 L20,32 L10,38 L13,26 L4,18 L16,16 Z" stroke="#c89968" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="iv-d-leaf" viewBox="0 0 80 80">
          <path d="M12,68 Q22,30 64,12 Q60,46 30,72 Q22,76 12,68 Z" stroke="#7a9968" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="iv-d-flower" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="6" stroke="#c47254" strokeWidth="2" fill="none" />
          <path d="M30,12 Q22,20 30,30 Q38,20 30,12 M30,48 Q22,40 30,30 Q38,40 30,48 M12,30 Q20,22 30,30 Q20,38 12,30 M48,30 Q40,22 30,30 Q40,38 48,30" stroke="#c47254" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      <div className="iv-topbar">
        <div className="iv-brand">
          Tale<span className="iv-brand-accent">Mory</span>
        </div>
      </div>

      <div className="iv-shell-inner" data-onboarding-target="viewer-main">
        <div className="iv-cover">
          <span className="iv-tape-l" aria-hidden="true" />
          <span className="iv-tape-r" aria-hidden="true" />

          <svg className="iv-cover-doodle iv-d1" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M20,4 L24,16 L36,18 L27,26 L30,38 L20,32 L10,38 L13,26 L4,18 L16,16 Z" stroke="#c89968" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg className="iv-cover-doodle iv-d2" viewBox="0 0 60 60" aria-hidden="true">
            <circle cx="30" cy="30" r="6" stroke="#c47254" strokeWidth="2" fill="none" />
            <path d="M30,12 Q22,20 30,30 Q38,20 30,12 M30,48 Q22,40 30,30 Q38,40 30,48 M12,30 Q20,22 30,30 Q20,38 12,30 M48,30 Q40,22 30,30 Q40,38 48,30" stroke="#c47254" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
          <svg className="iv-cover-doodle iv-d3" viewBox="0 0 40 40" aria-hidden="true">
            <path d="M20,34 C8,26 4,18 4,12 C4,6 9,3 14,5 C17,6 19,9 20,12 C21,9 23,6 26,5 C31,3 36,6 36,12 C36,18 32,26 20,34 Z" stroke="#c47254" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {story.coverIllustrationUrl && (
            <img src={story.coverIllustrationUrl} alt="" className="iv-cover-bg" />
          )}
          <div className="iv-cover-eyebrow">A STORYBOOK BY TALEMORY</div>

          <h1 className="iv-cover-title">{title}</h1>
          <div className="iv-cover-title-underline" aria-hidden="true" />

          <div className="iv-meta-row">
            <span className="iv-meta-pill">
              <span className="iv-meta-dot" aria-hidden="true" />
              {pageCount} 페이지
            </span>
            {publishedAtLabel && (
              <span className="iv-meta-pill">
                <span className="iv-meta-dot iv-rust" aria-hidden="true" />
                {publishedAtLabel}
              </span>
            )}
            <span className="iv-meta-pill">
              <span className="iv-meta-dot iv-gold" aria-hidden="true" />
              {difficultyLabel}
            </span>
            <span className="iv-meta-pill">
              <span className={`iv-meta-dot ${isWebtoon ? 'iv-rust' : ''}`} aria-hidden="true" />
              {modeLabel}
            </span>
          </div>

        </div>

        <button
          type="button"
          className="iv-cover-open-btn"
          onClick={onOpen}
          data-onboarding-target="viewer-open-book"
        >
          지금 열기
          <svg width="14" height="10" viewBox="0 0 14 10">
            <path d="M9,2 L13,5 L9,8 M13,5 L1,5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  )
}

/** "2026년 5월 6일" 같은 발행일 라벨. publishedAt 없으면 null. */
function formatPublishedAtLabel(publishedAt: string | null): string | null {
  if (!publishedAt) return null
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
}

/** BE Story.difficulty enum → 한글 라벨. 미지의 값은 그대로 표기. */
function formatDifficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case 'BEGINNER':
      return '초급'
    case 'INTERMEDIATE':
      return '중급'
    case 'ADVANCED':
      return '고급'
    default:
      return difficulty
  }
}
