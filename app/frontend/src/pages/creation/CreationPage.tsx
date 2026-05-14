import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BasicInfoStep,
  PhotoManagerStep,
  PromptStep,
  StoryboardEditorStep,
  StyleSelectorStep,
  VoiceCloneStep,
  HighlightOutroStep,
  FinalPreviewStep,
  PublishStoryStep,
  CreationDoodlesBg,
  CreationHeader,
  StepTitleBlock,
  useStoryCreationFlow,
  rehydrateStep1,
  rehydrateProgress,
} from '../../features/story-creation'
import type {
  UseStoryCreationFlowInit,
  StoryDraftResponse,
  StoryModeApi,
} from '../../features/story-creation'
import { ROUTES, buildViewerPath } from '../../shared/constants'
// bookshelf 모달과 동일 테마(step-forest-modal / bookshelf-scroll / bookshelf-fade-in)를 재사용하므로
// 해당 CSS 가 import 되어야 한다.
import '../../features/bookshelf/styles/bookshelf.css'
import '../../features/story-creation/styles/creation-paper.css'

type CreationLocationState = {
  draft?: StoryDraftResponse | null
  mode?: StoryModeApi
  onboardingPreview?: boolean
  onboardingPreviewStep?: number
} | null

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
  const location = useLocation()
  const state = location.state as CreationLocationState

  if (state?.onboardingPreview) {
    return <CreationOnboardingPreview step={state.onboardingPreviewStep ?? 1} />
  }

  return <CreationFlowPage initialState={state} />
}

function CreationFlowPage({ initialState }: { initialState: CreationLocationState }) {
  const navigate = useNavigate()
  /**
   * BookstoreScene "이어서 작성하기" 에서 `navigate(ROUTES.creation, { state: { draft } })` 로
   * 넘겨준 DRAFT 를 rehydrate 해서 flow 초기값으로 주입.
   * - state 없음 → 빈 step1 / storyId=null (신규 플로우)
   * - draft 있음 → step1 복원 + storyId 세팅 + 진행 메타로 lock 복원
   *   → 재클릭 시 PATCH 로 동작
   *
   * 진행 메타(stylePresetLocked / confirmedReadOnly)는 크롬 종료 → sessionStorage 비움
   * 시나리오에서 Step 5/6/7 락이 누락되는 버그를 막기 위해 BE 진실 기반으로 주입한다.
   */
  const init = useMemo<UseStoryCreationFlowInit | undefined>(() => {
    const state = initialState
    const draft = state?.draft
    // 신규 진입(state 없음 또는 mode 만 있음): mode 만 init 으로 전달, 나머지는 default state.
    if (!draft) {
      if (state?.mode) {
        return { mode: state.mode }
      }
      return undefined
    }
    const progress = rehydrateProgress(draft)
    return {
      storyId: draft.storyId,
      step1: rehydrateStep1(draft),
      // "이어서 작성하기" — 서버 DRAFT 의 mode 를 그대로 복원하여 플로우 일관성 유지.
      mode: draft.mode,
      stylePresetLocked: progress.stylePresetLocked,
      confirmedReadOnly: progress.confirmedReadOnly,
      voiceProfileId: progress.voiceProfileId,
    }
  }, [initialState])
  const flow = useStoryCreationFlow(init)

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
    // `/main/bookshelf` 가 라우트로 분리되어 있어 바로 진입하면 BookshelfModal 이 열린 상태로 mount.
    // replace: true 로 `/creation` 을 히스토리에서 치워 브라우저 뒤로가기가 제작 플로우로
    // 다시 빨려 들어가지 않도록 한다.
    navigate(ROUTES.mainBookshelf, { replace: true })
  }, [navigate])

  const storyboardReadOnly = flow.storyboardReadOnlyLocked

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
          storyId={flow.storyId}
          mode={flow.mode}
          onUpdate={flow.updateStep1}
          onChildUpdate={flow.updateChildAt}
          onChildAdd={flow.addChild}
          onChildAppend={flow.prependChild}
          onChildRemove={flow.removeChildAt}
          readOnly={storyboardReadOnly}
          onBack={handleBack}
          onStoryCreated={storyId => {
            flow.setStoryId(storyId)
            flow.handleNext()
          }}
          onStaleStoryIdReset={() => {
            // sessionStorage 의 storyId 가 DB 에 없을 때 (dev 리셋 등) 호출됨.
            // 진행 snapshot 비우고 storyId state 도 null 로 — 다음 클릭은 POST 모드.
            flow.setStoryId(null)
            flow.resetProgress()
          }}
        />
      )}

      {flow.currentStep === 2 && (
        <PhotoManagerStep
          storyId={flow.storyId}
          readOnly={storyboardReadOnly}
          onBack={handleBack}
          onNext={flow.handleNext}
        />
      )}

      {flow.currentStep === 3 && (
        <PromptStep
          storyId={flow.storyId}
          data={flow.projectData.step3}
          onStoryChange={flow.updateStoryText}
          onStoryJobStarted={flow.setStoryGenerationJobId}
          lastConfirmedSummaryJobId={flow.lastConfirmedSummaryJobId}
          onSummaryConfirmed={flow.setLastConfirmedSummaryJobId}
          readOnly={storyboardReadOnly}
          onBack={handleBack}
          onNext={flow.handleNext}
        />
      )}

      {flow.currentStep === 4 && (
        <StoryboardEditorStep
          storyId={flow.storyId}
          storyGenerationJobId={flow.storyGenerationJobId}
          onStoryJobFinished={() => flow.setStoryGenerationJobId(null)}
          readOnly={storyboardReadOnly}
          onBack={handleBack}
          onNext={flow.handleNext}
        />
      )}

      {flow.currentStep === 5 && (
        <StyleSelectorStep
          data={flow.projectData.step5}
          storyId={flow.storyId}
          onStyleChange={flow.updateStyle}
          onBack={handleBack}
          onNext={flow.handleNext}
          setFinalIllustrationJobId={flow.setFinalIllustrationJobId}
          finalIllustrationJobId={flow.finalIllustrationJobId}
          // 크롬 종료 → sessionStorage 비움 시나리오에서 in-memory `finalIllustrationJobId` 가
          // null 로 초기화되어도 BE 진실 기반의 `storyboardReadOnlyLocked` 로 락 유지.
          readOnly={flow.storyboardReadOnlyLocked}
        />
      )}

      {flow.currentStep === 6 && (
        <VoiceCloneStep
          storyId={flow.storyId}
          mode={flow.mode}
          onBack={handleBack}
          onNext={flow.handleNext}
          onVoiceSaved={flow.updateVoiceModel}
          readOnly={flow.confirmedReadOnlyLocked}
        />
      )}

      {flow.currentStep === 7 && (
        <HighlightOutroStep
          storyId={flow.storyId}
          projectData={flow.projectData}
          onBack={handleBack}
          onNext={flow.handleNext}
          setStoryGenerationJobId={flow.setStoryGenerationJobId}
          setFinalIllustrationJobId={flow.setFinalIllustrationJobId}
          markConfirmedReadOnly={flow.markConfirmedReadOnly}
          readOnly={flow.confirmedReadOnlyLocked}
        />
      )}

      {flow.currentStep === 8 && (
        <FinalPreviewStep
          storyId={flow.storyId}
          storyGenerationJobId={flow.storyGenerationJobId}
          finalIllustrationJobId={flow.finalIllustrationJobId}
          setStoryGenerationJobId={flow.setStoryGenerationJobId}
          setFinalIllustrationJobId={flow.setFinalIllustrationJobId}
          onBack={handleBack}
          onNext={flow.handleNext}
        />
      )}

      {flow.currentStep === 9 && (
        <PublishStoryStep
          storyId={flow.storyId}
          onBack={handleBack}
          onSaveToBookshelf={goToBookshelf}
          onOpenViewer={() => {
            if (flow.storyId) navigate(buildViewerPath(flow.storyId))
          }}
        />
      )}
    </div>
  )
}

function CreationOnboardingPreview({ step }: { step: number }) {
  const currentStep = Math.min(9, Math.max(1, step))
  const content = getOnboardingPreviewContent(currentStep)

  return (
    <div className="relative w-full h-full">
      <div className="cr-shell">
        <CreationDoodlesBg />
        <CreationHeader currentStep={currentStep} />

        <div className="cr-scroll">
          <main className="cr-shell-inner cr-fade-in">
            <StepTitleBlock
              stepNumber={currentStep}
              title={content.title}
              subtitle={content.subtitle}
            />

            <div className="cr-card" data-onboarding-target={`creation-step-${currentStep}-content`}>
              <span className="cr-tape" aria-hidden="true" />
              {content.body}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function getOnboardingPreviewContent(step: number) {
  switch (step) {
    case 1:
      return {
        title: '가족과 여행 정보 입력',
        subtitle: '주인공과 여행 정보를 적어 동화의 기본 재료를 만드는 화면이에요.',
        body: (
          <>
            <PreviewField label="주인공 정보" value="아이 이름, 나이, 성별을 입력하는 곳" />
            <PreviewField label="함께 여행한 사람" value="가족이나 친구 등 함께 등장할 사람을 적는 곳" />
            <PreviewField label="여행 일정과 장소" value="동화의 배경이 될 여행 날짜와 장소를 적는 곳" />
          </>
        ),
      }
    case 2:
      return {
        title: '추억 사진 업로드',
        subtitle: '사진을 올리고 대표 인물 사진을 골라 AI가 참고할 자료를 준비하는 화면이에요.',
        body: (
          <div style={{ display: 'grid', gap: 18 }}>
            <PreviewUploadBox title="추억 사진" text="여행 풍경, 가족 사진, 기억하고 싶은 장면을 모으는 곳" />
            <PreviewUploadBox title="대표 사진" text="주인공이 일관되게 보이도록 기준이 되는 사진을 고르는 곳" />
          </div>
        ),
      }
    case 3:
      return {
        title: '줄거리 만들기',
        subtitle: '원하는 분위기를 적고 AI가 만든 줄거리를 확인하는 화면이에요.',
        body: (
          <>
            <PreviewField label="원하는 이야기 분위기" value="따뜻하게, 모험처럼, 잠자리 동화처럼" />
            <div className="cr-hero-banner" style={{ margin: 0 }}>
              <div className="body">AI가 만든 줄거리를 여기에서 읽고 마음에 들면 다음 단계로 넘어갑니다.</div>
            </div>
          </>
        ),
      }
    case 4:
      return {
        title: '스토리보드 편집',
        subtitle: '페이지별 글과 그림을 보며 동화의 내용을 다듬는 화면이에요.',
        body: (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 0.8fr) 1.2fr', gap: 18 }}>
            <div className="cr-hero-banner" style={{ minHeight: 180, margin: 0 }}>
              <div className="body">페이지 그림 미리보기</div>
            </div>
            <div>
              <PreviewField label="한국어 본문" value="아이는 가족과 함께 낯선 숲길을 걸었어요." />
              <PreviewField label="영어 본문" value="The child walked along a forest path with family." />
            </div>
          </div>
        ),
      }
    case 5:
      return {
        title: '그림 스타일 선택',
        subtitle: '동화책 전체에 적용할 그림체를 고르는 화면이에요.',
        body: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
            {['수채화', '색연필', '그림책'].map(name => (
              <div key={name} className="cr-style-card">
                <div className="cr-style-thumb" />
                <h3 className="cr-style-name">{name}</h3>
              </div>
            ))}
          </div>
        ),
      }
    case 6:
      return {
        title: '목소리 준비',
        subtitle: '동화를 읽어줄 목소리를 녹음하거나 저장된 목소리를 불러오는 화면이에요.',
        body: (
          <div style={{ display: 'grid', gap: 14 }}>
            <PreviewUploadBox title="새 목소리 녹음" text="짧은 문장을 읽어 목소리 프로필을 만드는 곳" />
            <PreviewUploadBox title="저장된 목소리 불러오기" text="이미 등록한 목소리를 선택하는 곳" />
          </div>
        ),
      }
    case 7:
      return {
        title: '하이라이트와 맺음말',
        subtitle: '강조해서 읽을 문장과 마지막 인사를 정리하는 화면이에요.',
        body: (
          <>
            <PreviewField label="하이라이트 문장" value="가장 기억에 남는 장면을 골라 목소리로 강조하는 곳" />
            <PreviewField label="맺음말" value="아이에게 남기고 싶은 마지막 메시지를 쓰는 곳" />
          </>
        ),
      }
    case 8:
      return {
        title: '최종 미리보기',
        subtitle: '발행 전에 전체 동화책의 글, 그림, 음성을 확인하는 화면이에요.',
        body: (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div className="cr-hero-banner" style={{ minHeight: 220, margin: 0 }}>
              <div className="body">왼쪽 페이지</div>
            </div>
            <div className="cr-hero-banner" style={{ minHeight: 220, margin: 0 }}>
              <div className="body">오른쪽 페이지</div>
            </div>
          </div>
        ),
      }
    default:
      return {
        title: '동화 발행',
        subtitle: '완성한 동화책을 책장에 저장하고 공유 링크를 만드는 화면이에요.',
        body: (
          <div style={{ textAlign: 'center', display: 'grid', gap: 18 }}>
            <div className="cr-hero-banner" style={{ margin: 0 }}>
              <div className="body">발행이 완료되면 책장 보관, 뷰어 열기, 링크 공유를 할 수 있어요.</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="cr-btn-back">책장 보관</span>
              <span className="cr-btn-next">뷰어로 열기</span>
            </div>
          </div>
        ),
      }
  }
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="cr-field">
      <label className="cr-label">{label}</label>
      <input type="text" value={value} readOnly className="cr-input" />
    </div>
  )
}

function PreviewUploadBox({ title, text }: { title: string; text: string }) {
  return (
    <div
      style={{
        border: '2px dashed var(--cr-caramel)',
        borderRadius: 16,
        padding: 24,
        background: 'rgba(253, 246, 220, 0.7)',
      }}
    >
      <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--cr-font-serif)', fontSize: 22 }}>{title}</h3>
      <p style={{ margin: 0, fontFamily: 'var(--cr-font-gaegu)', fontSize: 18, color: 'var(--cr-ink-soft)' }}>{text}</p>
    </div>
  )
}
