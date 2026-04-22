import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  LayoutGrid,
  Sparkles,
  Wand2,
} from 'lucide-react'
import type { StoryboardPageDraft } from '../../model/types'
import { useStoryboardEditor } from '../model/useStoryboardEditor'
import { StoryboardGridView } from './StoryboardGridView'
import { StoryboardSingleView } from './StoryboardSingleView'
import { GlobalRefineModal } from './GlobalRefineModal'
import { PagePreviewModal } from './PagePreviewModal'

interface StoryboardEditorStepProps {
  /** step3.story (Grid view 상단 "이 동화책은 어떤 이야기인가요?" 카드) */
  storySummary: string
  pages: StoryboardPageDraft[]
  onPageUpdate: (idx: number, patch: Partial<StoryboardPageDraft>) => void
  onBack: () => void
  onNext: () => void
}

/**
 * STEP 04 — "전체 스토리보드 확인"
 *
 * 탭 2개:
 *  - Grid view: 스토리 요약 + 페이지 그리드 (클릭 시 PagePreviewModal)
 *  - Single view: 페이지 상세 편집 (en/ko textarea + 재생성)
 *
 * 상단 AI 전체 수정 요청 버튼 → GlobalRefineModal
 * 하단 "이전 / 다음: 그림 스타일 선택" 액션.
 */
export function StoryboardEditorStep({
  storySummary,
  pages,
  onPageUpdate,
  onBack,
  onNext,
}: StoryboardEditorStepProps) {
  const sb = useStoryboardEditor(pages.length)

  return (
    <div className="bookshelf-modal step-forest-modal">
      {/* Step 헤더 */}
      <div className="flex items-center justify-between py-4 px-8 border-b border-[#4a3a24] bg-[#2a1b12]/60 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="이전 단계"
            className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-[#4a3a24] text-[#d6c78e] bg-[#2a1b12]/70 hover:bg-[#2d5a27]/40 hover:text-[#f0e6c0] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-[#b4c4a4] text-sm font-bold tracking-wider">STEP 04 / 08</span>
          <span className="bookshelf-title-display text-2xl text-[#f0e6c0] font-bold">
            전체 스토리보드 확인
          </span>
        </div>
      </div>

      <div className="bookshelf-scroll">
        <main className="py-10 px-6 bookshelf-fade-in">
          <div className="max-w-5xl mx-auto pb-12">
            {/* 타이틀 */}
            <div className="mb-8 text-center">
              <div className="inline-flex items-center gap-2 bg-[#2d5a27]/60 px-5 py-2 rounded-full border border-[#b4dc8c]/50 shadow-sm mb-4">
                <Sparkles className="w-5 h-5 text-[#b4dc8c]" />
                <span className="text-[#b4dc8c] font-bold">AI 생성 완료!</span>
              </div>
              <h1 className="text-3xl md:text-4xl text-[#f0e6c0] mb-3 font-bold">
                우리 가족의 이야기 밑그림이 완성되었어요
              </h1>
              <p className="text-[#b4c4a4] text-lg">
                각 페이지의 스케치와 스토리가 마음에 드는지 확인해 주세요.
                <br className="hidden md:block" />
                필요하다면 수정 버튼을 눌러 내용을 다듬을 수 있습니다.
              </p>
            </div>

            {/* 탭 + AI 전체 수정 */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
              <div className="inline-flex bg-[#2a1b12]/70 p-1.5 rounded-full border-2 border-[#4a3a24] shadow-sm">
                <button
                  type="button"
                  onClick={() => sb.setView('grid')}
                  className={`px-6 py-2.5 rounded-full font-bold text-lg flex items-center gap-2 transition-all ${
                    sb.view === 'grid'
                      ? 'bg-[#2d5a27] text-[#f0e6c0] shadow-[0_0_14px_rgba(180,220,140,0.4)] border border-[#b4dc8c]/50'
                      : 'text-[#b4c4a4] hover:text-[#f0e6c0]'
                  }`}
                >
                  <LayoutGrid className="w-5 h-5" /> 그림으로 한번에 보기
                </button>
                <button
                  type="button"
                  onClick={() => sb.setView('single')}
                  className={`px-6 py-2.5 rounded-full font-bold text-lg flex items-center gap-2 transition-all ${
                    sb.view === 'single'
                      ? 'bg-[#2d5a27] text-[#f0e6c0] shadow-[0_0_14px_rgba(180,220,140,0.4)] border border-[#b4dc8c]/50'
                      : 'text-[#b4c4a4] hover:text-[#f0e6c0]'
                  }`}
                >
                  <BookOpen className="w-5 h-5" /> 개별 페이지 보기
                </button>
              </div>
              <button
                type="button"
                onClick={sb.openGlobalRefine}
                className="bg-[#f0e6c0] text-[#2d5a27] border-2 border-[#b4dc8c] px-6 py-3 rounded-full shadow-sm font-bold flex items-center gap-2 hover:bg-[#2d5a27] hover:text-[#f0e6c0] transition-colors text-lg"
              >
                <Wand2 className="w-5 h-5" /> AI에게 전체 수정 요청
              </button>
            </div>

            {/* 뷰 전환 */}
            {sb.view === 'grid' && (
              <StoryboardGridView
                storySummary={storySummary}
                pages={pages}
                onPagePreview={sb.openPreview}
              />
            )}
            {sb.view === 'single' && (
              <StoryboardSingleView
                pages={pages}
                index={sb.index}
                onPrev={sb.prev}
                onNext={sb.next}
                onPageUpdate={onPageUpdate}
                pageRefineRemaining={sb.pageRefineRemaining}
                onRegenerate={sb.regeneratePage}
              />
            )}

            {/* 하단 액션 */}
            <div className="flex justify-between items-center pt-8 mt-8 border-t border-[#4a3a24]">
              <button
                type="button"
                onClick={onBack}
                className="text-[#b4c4a4] hover:text-[#f0e6c0] px-4 py-2 text-xl font-bold transition-colors"
              >
                이전
              </button>
              <div className="text-[#b4dc8c] font-bold hidden sm:flex items-center gap-2 bg-[#2d5a27]/60 px-6 py-2.5 rounded-full border border-[#b4dc8c]/40 text-lg shadow-sm">
                <CheckCircle className="w-6 h-6" />
                <span>모든 내용을 확인했습니다</span>
              </div>
              <button
                type="button"
                onClick={onNext}
                className="bg-[#2d5a27] text-[#f0e6c0] px-10 py-4 rounded-full border border-[#b4dc8c]/40 shadow-[0_4px_0_#1a3a14,0_0_20px_rgba(180,220,140,0.25)] hover:translate-y-1 hover:shadow-[0_2px_0_#1a3a14,0_0_30px_rgba(180,220,140,0.5)] hover:bg-[#3d6f34] transition-all font-bold flex items-center gap-3 text-xl whitespace-nowrap"
              >
                다음: 그림 스타일 선택 <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* 모달 2종 */}
      <GlobalRefineModal
        isOpen={sb.isGlobalRefineOpen}
        remaining={sb.globalRefineRemaining}
        onClose={sb.closeGlobalRefine}
        onSubmit={sb.submitGlobalRefine}
      />
      <PagePreviewModal
        previewIndex={sb.previewIndex}
        pages={pages}
        onClose={sb.closePreview}
        onGoToDetail={sb.goToDetailFromPreview}
      />
    </div>
  )
}
