import { Quote } from 'lucide-react'
import type { StoryboardPageDraft } from '../../model/types'
import { getPageIcon } from '../../../../shared/lib'
import { IllustrationMockup } from '../../../../shared/ui'
import { VoicePlayerMock } from './VoicePlayerMock'

interface BookSpreadProps {
  page: StoryboardPageDraft
  /** 0-based 페이지 인덱스. 표시용 페이지 번호는 idx*2+1 / idx*2+2. */
  pageIndex: number
  voiceModel: string | null
}

/**
 * 펼쳐진 동화책 1 스프레드(좌/우 2페이지).
 * - 중앙 접힘선 그림자
 * - 왼쪽: 삽화 목업 (gradient + vintage 내부 프레임 + 아이콘 + sketch 텍스트)
 * - 오른쪽: 인용 아이콘 + 영문 본문(큰 글씨) + divider + 한글 본문 + 보이스 플레이어
 */
export function BookSpread({ page, pageIndex, voiceModel }: BookSpreadProps) {
  const Icon = getPageIcon(page.icon)
  return (
    <div className="w-full aspect-auto md:aspect-[2/1.1] bg-[#fff9dd] rounded-xl md:rounded-3xl flex flex-col md:flex-row relative border-2 border-[#2a1b12] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* 중앙 접힘선 */}
      <div
        className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-12 pointer-events-none z-20"
        style={{
          background:
            'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.15) 50%, rgba(255,255,255,0.4) 55%, rgba(0,0,0,0) 100%)',
        }}
      />

      {/* 왼쪽 페이지: 삽화 */}
      <div className="flex-1 p-6 md:p-10 flex items-center justify-center relative">
        <div className="absolute bottom-4 left-8 text-[#8b7a52] font-sans text-sm">
          {pageIndex * 2 + 1}
        </div>
        <div className="w-full h-full bg-gradient-to-br from-[#e8ddb4] to-[#b4dc8c]/60 rounded-2xl p-4 md:p-6 shadow-inner border border-[#f0e6c0]/70 relative group">
          <div className="w-full h-full bg-[#fff9dd]/60 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center border-2 border-[#f0e6c0] relative overflow-hidden">
            {/* 배경 풍경 목업 (약하게) */}
            <IllustrationMockup
              variant="scenery"
              className="absolute inset-0 w-full h-full text-[#2d5a27] opacity-70"
            />
            {/* 중앙 아이콘 + 스케치 텍스트 */}
            <div className="relative z-10 flex flex-col items-center">
              <Icon
                className="w-24 h-24 text-[#2d5a27] opacity-80 mb-4 transform group-hover:scale-110 transition-transform duration-700"
                strokeWidth={2}
              />
              <p className="text-[#2d5a27] text-xl opacity-80 font-bold text-center px-4">
                {page.sketch}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 오른쪽 페이지: 글 + 음성 */}
      <div className="flex-1 p-6 md:p-12 flex flex-col relative">
        <div className="absolute bottom-4 right-8 text-[#8b7a52] font-sans text-sm">
          {pageIndex * 2 + 2}
        </div>

        <Quote className="w-10 h-10 text-[#b4dc8c] opacity-60 mb-4" />

        <p className="text-2xl md:text-3xl lg:text-[2.2rem] text-[#2a1b12] leading-[1.5] font-sans font-medium">
          {page.en}
        </p>

        <div className="w-16 h-1 bg-[#b4dc8c] rounded-full my-6" />

        <p className="text-lg md:text-xl text-[#8b7a52] leading-relaxed">{page.ko}</p>

        {/* 음성 플레이어 */}
        <div className="mt-auto pt-6">
          <VoicePlayerMock voiceModel={voiceModel} />
        </div>
      </div>
    </div>
  )
}
