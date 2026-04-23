import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BasicInfoStep,
  PhotoManagerStep,
  StoryTextStep,
  StoryboardEditorStep,
  StyleSelectorStep,
  VoiceCloneStep,
  FinalPreviewStep,
  PublishStoryStep,
  useStoryCreationFlow,
} from '../../features/story-creation'
import { ROUTES, buildViewerPath } from '../../shared/constants'
import { DUMMY_STORIES } from '../../entities/story'
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

  /**
   * 제작 플로우 이탈 공통 네비게이션.
   *
   * `/main` 으로 가면 새 MainPage 인스턴스가 마운트돼, 책장 씬의 ← (back-to-forest)
   * 버튼을 누르면 뜬금없이 숲 씬이 "붙어 있는" 것처럼 보이는 UX 혼선이 있었다.
   * 대신 원래 인라인 MainPage 를 품고 있던 `/` 로 돌아가서 책장 씬으로 진입시키고,
   * `skipLanding` 플래그로 HomePage 의 랜딩 애니메이션을 스킵한다.
   * `replace: true` 로 `/creation` 을 히스토리에서 치워 브라우저 뒤로가기가
   * 제작 플로우로 다시 빨려 들어가지 않도록 한다.
   */
  const goToBookshelf = useCallback(() => {
    navigate(ROUTES.home, {
      state: { scene: 'bookstore', skipLanding: true },
      replace: true,
    })
  }, [navigate])

  const handleBack = useCallback(() => {
    if (flow.currentStep > 1) {
      flow.handlePrev()
    } else {
      // step 1 에서 back → 책장(서점) 씬으로 복귀 (랜딩/숲 재생 없이).
      goToBookshelf()
    }
  }, [flow, goToBookshelf])

  return (
    <div className="relative w-full h-full">
      {flow.currentStep === 1 && (
        <BasicInfoStep
          data={flow.projectData.step1}
          onUpdate={flow.updateStep1}
          onChildUpdate={flow.updateChildAt}
          onChildAdd={flow.addChild}
          onChildAppend={flow.appendChild}
          onChildRemove={flow.removeChildAt}
          onBack={handleBack}
          onStoryCreated={storyId => {
            flow.setStoryId(storyId)
            flow.handleNext()
          }}
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
          storySummary={flow.projectData.step3.story}
          pages={flow.projectData.step4.pages}
          onPageUpdate={flow.updateStoryboardPage}
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
        <VoiceCloneStep
          onBack={handleBack}
          onNext={flow.handleNext}
          onVoiceSaved={flow.updateVoiceModel}
        />
      )}

      {flow.currentStep === 7 && (
        <FinalPreviewStep
          projectData={flow.projectData}
          onBack={handleBack}
          onSaveToBookshelf={goToBookshelf}
          onOpenViewer={() => navigate(buildViewerPath(DUMMY_STORIES[0]?.id ?? 1))}
        />
      )}

      {flow.currentStep === 8 && (
        <PublishStoryStep onBack={handleBack} onExit={goToBookshelf} />
      )}
    </div>
  )
}
