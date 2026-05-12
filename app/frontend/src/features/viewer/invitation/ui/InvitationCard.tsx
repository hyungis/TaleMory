import type { StoryView } from '../../model/types'
import '../styles/invitation.css'

interface InvitationCardProps {
  story: StoryView
  isOwner: boolean
  onOpenBook: () => void
  onOpenWebtoon: () => void
  onBack: () => void
}

/**
 * 뷰어 진입 화면 — paper-craft 톤.
 * 동화 표지 카드(제목, 작가, 페이지 수/날짜/난이도) + 두 모드 선택(동화책/웹툰).
 *
 * 디자인 요소:
 *  - 워시 테이프, 코너 doodle, sage 원형 책 아이콘, rust 손글씨 underline
 *  - meta pill 3종, mode 카드의 sage/rust 큰 CTA, preview strip(가로/세로)
 */
export function InvitationCard({
  story,
  onOpenBook,
  onOpenWebtoon,
  onBack,
}: InvitationCardProps) {
  const title = story.title?.trim() || '제목 없는 동화'
  const pageCount = story.scenes.length
  const publishedAtLabel = formatPublishedAtLabel(story.publishedAt)
  const difficultyLabel = formatDifficultyLabel(story.difficulty)

  return (
    <section className="iv-shell">
      <div className="iv-bg-base" aria-hidden="true" />
      <div className="iv-bg-grain" aria-hidden="true" />
      <div className="iv-bg-crayon" aria-hidden="true" />

      {/* 손그림 distortion 필터 — doodle 들이 살짝 떨리는 느낌 */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="iv-crayon-rough" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={3} />
            <feDisplacementMap in="SourceGraphic" scale="1.2" />
          </filter>
        </defs>
      </svg>

      {/* 화면 가장자리 doodle — 구름 / 별 / 잎 / 꽃 */}
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

      {/* 상단 바 */}
      <div className="iv-topbar">
        <button type="button" className="iv-back-btn" onClick={onBack}>
          <svg width="14" height="10" viewBox="0 0 14 10">
            <path d="M5,2 L1,5 L5,8 M1,5 L13,5" stroke="#4a3b2a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          돌아가기
        </button>
        <div className="iv-brand">
          Tale<span className="iv-brand-accent">Mory</span>
        </div>
      </div>

      {/* 메인 영역 */}
      <div className="iv-shell-inner" data-onboarding-target="viewer-main">
        {/* 표지 카드 */}
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

          <div className="iv-cover-eyebrow">A STORYBOOK BY TALEMORY</div>

          <div className="iv-book-mark" aria-hidden="true">
            {story.coverIllustrationUrl ? (
              <img src={story.coverIllustrationUrl} alt="" />
            ) : (
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
                <path d="M3,5 C5,4 9,4 11,6 L11,20 C9,18 5,18 3,19 Z M21,5 C19,4 15,4 13,6 L13,20 C15,18 19,18 21,19 Z" stroke="#fdf6dc" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
              </svg>
            )}
          </div>

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
          </div>
        </div>

        {/* 모드 안내 */}
        <div className="iv-choose-eyebrow">
          <div className="iv-choose-label">어떻게 읽어볼까요?</div>
          <div className="iv-choose-sub">
            동화책처럼 한 장씩 넘기거나, 웹툰처럼 쭉 스크롤해서 읽을 수 있어요
          </div>
        </div>

        {/* 모드 선택 */}
        <div className="iv-modes">
          <button
            type="button"
            className="iv-mode iv-mode-book"
            onClick={onOpenBook}
            data-onboarding-target="viewer-open-book"
          >
            <span className="iv-mode-corner" aria-hidden="true" />
            <div className="iv-mode-icon-circle" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M3,5 C5,4 9,4 11,6 L11,20 C9,18 5,18 3,19 Z M21,5 C19,4 15,4 13,6 L13,20 C15,18 19,18 21,19 Z" stroke="#fdf6dc" strokeWidth="1.7" fill="none" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="iv-mode-title">동화책 모드</h2>
            <p className="iv-mode-sub">
              한 페이지씩 넘기며 읽어요
              <br />
              그림과 글이 마주보는 펼침면
            </p>
            <span className="iv-open-cta">
              지금 열기
              <svg width="14" height="10" viewBox="0 0 14 10">
                <path d="M9,2 L13,5 L9,8 M13,5 L1,5" stroke="#fdf6dc" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="iv-preview-strip" aria-hidden="true">
              <div className="iv-pg" />
              <div className="iv-pg" />
              <div className="iv-pg" />
              <div className="iv-pg" />
            </div>
          </button>

          <button
            type="button"
            className="iv-mode iv-mode-web"
            onClick={onOpenWebtoon}
            disabled
            aria-label="웹툰 모드 — 준비 중"
          >
            <span className="iv-mode-corner" aria-hidden="true" />
            <div className="iv-mode-icon-circle" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M5,2 L19,2 L17,12 L19,22 L5,22 L7,12 Z M5,2 C3,2 3,5 5,5 M19,2 C21,2 21,5 19,5 M5,22 C3,22 3,19 5,19 M19,22 C21,22 21,19 19,19" stroke="#fdf6dc" strokeWidth="1.6" fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M9,8 L15,8 M9,12 L15,12 M9,16 L15,16" stroke="#fdf6dc" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="iv-mode-title">웹툰 모드</h2>
            <p className="iv-mode-sub">
              세로로 스크롤하며 읽어요
              <br />
              한 흐름으로 이어보는 이야기
            </p>
            <span className="iv-open-cta">
              지금 열기
              <svg width="14" height="10" viewBox="0 0 14 10">
                <path d="M9,2 L13,5 L9,8 M13,5 L1,5" stroke="#fdf6dc" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="iv-preview-strip iv-web" aria-hidden="true">
              <div className="iv-pg" />
              <div className="iv-pg" />
              <div className="iv-pg" />
            </div>

            {/* 준비중 오버레이 — 카드 전체 위에 어두운 막 + 텍스트만 */}
            <div className="iv-mode-disabled-overlay" aria-hidden="true">
              <p className="iv-mode-disabled-title">준비 중이에요</p>
              <p className="iv-mode-disabled-sub">곧 만나보실 수 있어요</p>
            </div>
          </button>
        </div>
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
