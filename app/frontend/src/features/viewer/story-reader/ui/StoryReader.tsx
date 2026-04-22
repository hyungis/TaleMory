import { useRef } from 'react'
import HTMLFlipBook from 'react-pageflip'
import { BookOpenText, Sparkles } from 'lucide-react'
import type { StoryboardPageDraft } from '../../../../entities'
import { getPageIcon } from '../../../../shared/lib'
import { IllustrationMockup } from '../../../../shared/ui'
import { StoryPage } from './StoryPage'

interface StoryReaderProps {
  title: string
  pages: StoryboardPageDraft[]
}

/**
 * react-pageflip 기반 동화책 뷰어 (소비 중심 도메인 — 제작 도메인과 분리).
 *
 * 페이지 구성:
 *  - 앞표지: 제목 + TaleMory 부제 + Sparkles glow + 풍경 목업
 *  - 내부 페이지: 상단 일러스트 목업(아이콘 + 풍경) + 하단 영문/한글 본문
 *  - 뒷표지: The End + 저작권 표시
 *
 * TODO: TTS 재생 / 번역 토글 / 문장별 하이라이트 / 책갈피 (후속 Task)
 */
export function StoryReader({ title, pages }: StoryReaderProps) {
  const flipRef = useRef<unknown>(null)

  return (
    <div className="w-full h-full flex items-center justify-center p-6 bg-[#0a1a0a]">
      {/* @ts-expect-error react-pageflip 타입 정의가 React 19 와 살짝 안 맞음 */}
      <HTMLFlipBook
        ref={flipRef}
        width={450}
        height={600}
        maxShadowOpacity={0.5}
        showCover
        mobileScrollSupport
        className="shadow-2xl"
      >
        {/* ── 앞표지 ── */}
        <StoryPage className="flex flex-col items-center justify-center text-center bg-gradient-to-br from-[#2d5a27] to-[#1a3a14] text-[#f0e6c0] relative overflow-hidden">
          <IllustrationMockup
            variant="scenery"
            className="absolute inset-x-0 bottom-0 w-full h-1/2 text-[#b4dc8c]"
          />
          <Sparkles className="absolute top-12 right-14 w-10 h-10 text-[#b4dc8c]/70" />
          <Sparkles className="absolute top-20 left-16 w-6 h-6 text-[#b4dc8c]/50" />

          <div className="relative z-10 px-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#b4dc8c] mb-4 font-sans">
              TaleMory
            </p>
            <BookOpenText className="w-14 h-14 mx-auto mb-4 text-[#b4dc8c]" />
            <h1 className="text-3xl font-bold mb-3 leading-tight">{title}</h1>
            <div className="w-16 h-px bg-[#b4dc8c]/60 mx-auto my-4" />
            <p className="text-sm opacity-80 italic">우리 가족의 이야기</p>
          </div>
        </StoryPage>

        {/* ── 내부 페이지 ── */}
        {pages.map((p, idx) => {
          const Icon = getPageIcon(p.icon)
          return (
            <StoryPage key={idx}>
              <div className="h-full flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-[#8b7a52] font-sans">
                    Page {idx + 1}
                  </span>
                  <span className="text-[10px] text-[#8b7a52] font-sans">{idx + 1} / {pages.length}</span>
                </div>

                {/* 일러스트 목업 영역 */}
                <div className="relative flex-[1.3] rounded-xl overflow-hidden mb-4 border border-[#8b7a52]/40 bg-gradient-to-b from-[#fff9dd] to-[#e8ddb4]">
                  <IllustrationMockup
                    variant="scenery"
                    className="absolute inset-0 w-full h-full text-[#2d5a27]"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-[#f0e6c0]/85 backdrop-blur-sm border border-[#8b7a52]/40 rounded-xl px-4 py-3 max-w-[80%] text-center shadow">
                      <Icon
                        className="w-10 h-10 mx-auto mb-1 text-[#2d5a27]"
                        strokeWidth={2.2}
                      />
                      <p className="text-xs text-[#2d5a27] font-bold">{p.sketch}</p>
                    </div>
                  </div>
                </div>

                {/* 본문 */}
                <div className="flex-1 flex flex-col justify-center">
                  <p className="text-[#2d5a27] font-bold mb-2 text-base leading-snug">{p.en}</p>
                  <div className="border-t border-[#8b7a52]/30 pt-2">
                    <p className="text-xs text-[#8b7a52] leading-relaxed">{p.ko}</p>
                  </div>
                </div>
              </div>
            </StoryPage>
          )
        })}

        {/* ── 뒷표지 ── */}
        <StoryPage className="flex flex-col items-center justify-center text-center bg-[#2a1b12] text-[#f0e6c0] relative overflow-hidden">
          <IllustrationMockup
            variant="minimal"
            className="absolute top-10 left-0 w-full h-20 text-[#b4dc8c]"
          />
          <div className="relative z-10">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#b4dc8c]/70" />
            <p className="text-2xl font-bold opacity-90 mb-2">The End</p>
            <div className="w-16 h-px bg-[#b4dc8c]/30 mx-auto my-3" />
            <p className="text-xs opacity-60 font-sans">© TaleMory</p>
          </div>
        </StoryPage>
      </HTMLFlipBook>
    </div>
  )
}
