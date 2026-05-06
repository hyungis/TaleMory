import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { BookBackCover, StoryBookViewer, useSampleStoryViewQuery } from '../../features/viewer'
import { BookshelfDoodles } from '../../features/bookshelf'
import './styles/about.css'

const OUTRO_TEXT = '오늘도 우리 가족과 함께 동화책을 읽어서 정말 행복했어!\n다음에 또 재밌는 이야기 읽자, 사랑해~'
const OUTRO_SIGNATURE = '— 사랑하는 엄마가'
/** 타이핑 완료 후 잠시 보여주고 다시 시작하는 간격 (ms) */
const REPLAY_INTERVAL = OUTRO_TEXT.length * 75 + 3000

export function AboutPage() {
  const navigate = useNavigate()
  const { status, data: sampleStory } = useSampleStoryViewQuery()
  const [outroKey, setOutroKey] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setOutroKey(k => k + 1), REPLAY_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="about-page">
      {/* 배경 doodles + 텍스처 */}
      <div className="about-doodles-bg" aria-hidden="true">
        <BookshelfDoodles />
      </div>

      {/* 상단 네비게이션 */}
      <nav className="about-nav">
        <button
          type="button"
          className="about-back-btn"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="w-5 h-5" />
          <span>돌아가기</span>
        </button>
      </nav>

      {/* Hero 섹션 */}
      <section className="about-hero">
        <div className="about-hero__tape" />
        <h1 className="about-hero__title">TaleMory</h1>
        <p className="about-hero__subtitle">가족의 추억으로 만드는 영어 동화책</p>
        <div className="about-hero__divider" />
        <p className="about-hero__desc">
          소중한 가족 이야기를 AI가 영어 동화로 만들어드려요.<br />
          아이의 목소리로 직접 녹음하고, 세상에 하나뿐인 그림책을 완성하세요.
        </p>
      </section>

      {/* How it works 섹션 */}
      <section className="about-steps">
        <h2 className="about-section-title">이렇게 만들어져요</h2>
        <div className="about-steps__timeline">
          <div className="about-step">
            <div className="about-step__number">1</div>
            <div className="about-step__content">
              <h3 className="about-step__title">추억 입력</h3>
              <p className="about-step__desc">가족과의 소중한 추억을 키워드나 문장으로 입력해요</p>
            </div>
          </div>
          <div className="about-step">
            <div className="about-step__number">2</div>
            <div className="about-step__content">
              <h3 className="about-step__title">스토리 생성</h3>
              <p className="about-step__desc">AI가 영어 동화 스토리와 스토리보드를 만들어줘요</p>
            </div>
          </div>
          <div className="about-step">
            <div className="about-step__number">3</div>
            <div className="about-step__content">
              <h3 className="about-step__title">삽화 & 음성</h3>
              <p className="about-step__desc">AI 삽화를 생성하고, 목소리를 녹음하거나 TTS를 선택해요</p>
            </div>
          </div>
          <div className="about-step">
            <div className="about-step__number">4</div>
            <div className="about-step__content">
              <h3 className="about-step__title">동화책 완성</h3>
              <p className="about-step__desc">세상에 하나뿐인 영어 동화책이 완성돼요!</p>
            </div>
          </div>
        </div>
      </section>

      {/* 샘플 동화책 뷰어 섹션 */}
      <section className="about-sample">
        <h2 className="about-section-title">완성된 동화책을 미리 볼까요?</h2>
        <div className="about-sample__viewer-wrapper">
          {status === 'loading' && (
            <div className="about-sample__loading">
              <div className="about-sample__spinner" />
              <p>샘플 동화책을 불러오는 중이에요...</p>
            </div>
          )}
          {status === 'error' && (
            <div className="about-sample__error">
              <p>샘플 동화책을 불러오지 못했어요.</p>
            </div>
          )}
          {status === 'success' && sampleStory && (
            <StoryBookViewer story={sampleStory} onExit={() => {}} mode="preview" />
          )}
        </div>
      </section>

      {/* 아웃트로 체험 섹션 */}
      <section className="about-outro">
        <h2 className="about-section-title">동화를 다 읽으면, 편지가 도착해요</h2>
        <p className="about-outro__desc">
          녹음한 목소리와 따뜻한 메시지가 편지지 위에 담겨요
        </p>
        <div className="about-outro__wrapper">
          <BookBackCover
            key={outroKey}
            outro={{
              outroText: OUTRO_TEXT,
              audioUrl: null,
              signature: OUTRO_SIGNATURE,
            }}
            onRestart={() => {}}
            illustrationUrl={null}
          />
        </div>
      </section>

    </div>
  )
}
