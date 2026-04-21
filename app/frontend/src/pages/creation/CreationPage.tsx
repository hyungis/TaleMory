import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BasicInfoStep,
  PhotoManagerStep,
  StoryTextStep,
  StoryboardEditorStep,
  StyleSelectorStep,
  VoiceCloneStep,
  useStoryCreationFlow,
} from '../../features/story-creation'
import { ROUTES } from '../../shared/constants'
// bookshelf 모달과 동일 테마(step-forest-modal / bookshelf-scroll / bookshelf-fade-in)를 재사용하므로
// 해당 CSS 가 import 되어야 한다.
import '../../features/bookshelf/styles/bookshelf.css'

/**
 * 동화 제작 플로우 라우트(`/creation`).
 *
 * 내부에서 step 1~8 을 state 로 관리하며 full-screen 모달처럼 렌더한다
 * (원본의 `.bookshelf-modal.step-forest-modal` 재사용).
 *
 * Task 4a: step 1(basic-info) 만 구현. step 1 에서 back 누르면 /main 으로 이탈.
 * 이후 Task 4b~8 에서 step 2~8 컴포넌트 추가 예정.
 */
export function CreationPage() {
  const navigate = useNavigate()
  const flow = useStoryCreationFlow()

  const handleBack = useCallback(() => {
    if (flow.currentStep > 1) {
      flow.handlePrev()
    } else {
      // step 1 에서 back → 메인(서점) 씬으로 복귀
      navigate(ROUTES.main)
    }
  }, [flow, navigate])

  return (
    <div className="relative w-full h-full">
      {flow.currentStep === 1 && (
        <BasicInfoStep
          data={flow.projectData.step1}
          onUpdate={flow.updateStep1}
          onChildUpdate={flow.updateChildAt}
          onChildAdd={flow.addChild}
          onChildRemove={flow.removeChildAt}
          onBack={handleBack}
          onNext={flow.handleNext}
        />
      )}

      {flow.currentStep === 2 && (
        <PhotoManagerStep
          data={flow.projectData.step2}
          onUpdate={flow.updateStep2}
          onBack={handleBack}
          onNext={flow.handleNext}
        />
      )}

      {flow.currentStep === 3 && (
        <StoryTextStep
          data={flow.projectData.step3}
          onStoryChange={flow.updateStoryText}
          onBack={handleBack}
          onNext={flow.handleNext}
        />
      )}

      {flow.currentStep === 4 && (
        <StoryboardEditorStep
          data={flow.projectData.step4}
          onBack={handleBack}
          onNext={flow.handleNext}
        />
      )}

      {flow.currentStep === 5 && (
        <StyleSelectorStep
          data={flow.projectData.step5}
          onStyleChange={flow.updateStyle}
          onBack={handleBack}
          onNext={flow.handleNext}
        />
      )}

      {flow.currentStep === 6 && (
        <VoiceCloneStep onBack={handleBack} onNext={flow.handleNext} />
      )}

      {flow.currentStep >= 7 && (
        <div className="bookshelf-modal step-forest-modal flex items-center justify-center">
          <div className="max-w-md text-center text-[#f0e6c0] px-6">
            <h2 className="text-2xl font-bold mb-3">STEP {flow.currentStep} 준비 중</h2>
            <p className="text-[#b4c4a4] mb-6">이 단계는 다음 커밋(Task 8)에서 연결됩니다.</p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={flow.handlePrev}
                className="bg-[#8b7a52] text-[#f0e6c0] px-6 py-2 rounded-full border border-[#d4b86a] font-bold hover:bg-[#a89664] transition-colors"
              >
                ← 이전
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.main)}
                className="bg-[#2d5a27] text-[#f0e6c0] px-6 py-2 rounded-full border border-[#b4dc8c]/40 font-bold hover:bg-[#3d6f34] transition-colors"
              >
                서점으로 나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
