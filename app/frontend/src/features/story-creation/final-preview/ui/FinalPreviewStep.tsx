import { Eye } from 'lucide-react'
import type { ProjectData } from '../../model/types'
import { StepHeader } from '../../ui/StepHeader'
import { NextButton } from '../../ui/NextButton'

interface FinalPreviewStepProps {
  projectData: ProjectData
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 07 — 최종 미리보기.
 * 지금까지 입력된 프로젝트 데이터를 요약 형태로 표시.
 * 실제 AI 생성된 최종 장면 렌더링(삽화 + TTS + BGM)은 백엔드 연동 시 추가.
 */
export function FinalPreviewStep({ projectData, onBack, onNext }: FinalPreviewStepProps) {
  const children = projectData.step1.children.filter(c => c.name.trim())
  const photoCount = projectData.step2.photos.length
  const pageCount = projectData.step4.pages.length

  return (
    <div className="bookshelf-modal step-forest-modal">
      <StepHeader stepNumber={7} stepTitle="최종 미리보기" onBack={onBack} />
      <div className="bookshelf-scroll">
        <main className="py-12 px-6 bookshelf-fade-in">
          <div className="max-w-3xl mx-auto bg-[#f0e6c0] p-8 md:p-12 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border-2 border-[#2a1b12]">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <Eye className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl text-[#2d5a27] font-bold">거의 다 됐어요!</h2>
              <p className="text-[#8b7a52] mt-2">아래 내용으로 동화책을 생성할게요.</p>
            </div>

            <div className="space-y-4">
              <SummaryRow label="주인공">
                {children.length > 0
                  ? children.map(c => `${c.name} (${c.gender}, ${c.age || '?'}세)`).join(', ')
                  : '(입력되지 않음)'}
              </SummaryRow>
              <SummaryRow label="함께 여행한 사람">{projectData.step1.companions || '(입력되지 않음)'}</SummaryRow>
              <SummaryRow label="난이도">{projectData.step1.level}</SummaryRow>
              <SummaryRow label="여행 일정">
                {projectData.step1.travelDates.length > 0 ? projectData.step1.travelDates.join(' ~ ') : '(입력되지 않음)'}
              </SummaryRow>
              <SummaryRow label="여행 장소">{projectData.step1.location || '(입력되지 않음)'}</SummaryRow>
              <SummaryRow label="업로드한 사진">{photoCount}장</SummaryRow>
              <SummaryRow label="스토리보드 페이지">{pageCount}페이지</SummaryRow>
              <SummaryRow label="삽화 스타일">{projectData.step5.style}</SummaryRow>
            </div>

            <div className="mt-8 bg-[#e8ddb4]/60 border-2 border-dashed border-[#8b7a52]/40 rounded-xl p-6 text-center">
              <p className="text-[#8b7a52] text-sm mb-2">
                TODO(S14P31S210-76): AI 최종 렌더링(삽화 + TTS + BGM 합성) 미리보기 플레이어
              </p>
              <p className="text-xs text-[#8b7a52]/70">
                백엔드 제작 완료 엔드포인트 + 미디어 재생 UI 는 후속 커밋에서 추가.
              </p>
            </div>

            <NextButton onClick={onNext}>동화책 발행하기</NextButton>
          </div>
        </main>
      </div>
    </div>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 pb-3 border-b border-[#8b7a52]/30 last:border-0">
      <span className="w-32 shrink-0 text-[#8b7a52] font-bold text-sm">{label}</span>
      <span className="flex-1 text-[#2d5a27]">{children}</span>
    </div>
  )
}
