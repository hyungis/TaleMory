import { useRef } from 'react'
import HTMLFlipBook from 'react-pageflip'
import type { StoryboardPageDraft } from '../../../story-creation/model/types'
import { StoryPage } from './StoryPage'

interface StoryReaderProps {
  title: string
  pages: StoryboardPageDraft[]
}

/**
 * react-pageflip 기반 동화책 뷰어 (소비 중심 도메인 — 제작 도메인과 분리).
 *
 * 현재(Task 9)는 책 넘김 기본 동작만 구현.
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
        {/* 앞표지 */}
        <StoryPage className="flex flex-col items-center justify-center text-center bg-gradient-to-br from-[#2d5a27] to-[#1a3a14] text-[#f0e6c0]">
          <h1 className="text-3xl font-bold mb-3">{title}</h1>
          <p className="text-sm opacity-80">— TaleMory —</p>
        </StoryPage>

        {/* 내부 페이지 */}
        {pages.map((p, idx) => (
          <StoryPage key={idx}>
            <div className="h-full flex flex-col">
              <div className="text-xs text-[#8b7a52] mb-2">Page {idx + 1}</div>
              <div className="flex-1 bg-gradient-to-br from-[#e8ddb4] to-[#d4b86a]/60 rounded-lg flex items-center justify-center mb-4 text-center text-[#8b7a52] p-4">
                🎨 {p.sketch}
              </div>
              <p className="text-[#2d5a27] font-bold mb-1">{p.en}</p>
              <p className="text-xs text-[#8b7a52]">{p.ko}</p>
            </div>
          </StoryPage>
        ))}

        {/* 뒷표지 */}
        <StoryPage className="flex flex-col items-center justify-center text-center bg-[#2a1b12] text-[#f0e6c0]">
          <p className="text-lg opacity-80">The End</p>
          <p className="text-xs opacity-60 mt-2">© TaleMory</p>
        </StoryPage>
      </HTMLFlipBook>
    </div>
  )
}
