import { useCallback, useEffect, useState } from 'react'
import type { StoryChild, StoryProject, StoryboardPageDraft } from './types'
import { MAX_STEP } from './types'
import { DEFAULT_STORYBOARD_PAGES } from '../storyboard-editor/lib/defaults'

// 레거시 저장 키 (목업 전환 이전 버전에서 localStorage 에 남아있을 수 있어 한 번 정리해준다).
const LEGACY_STORAGE_KEY_STEP = 'talemory_draft_step'
const LEGACY_STORAGE_KEY_DATA = 'talemory_draft_project'

/**
 * 새로고침 후 재진입 시 현재 단계 + storyId + step3 한글 본문을 복구하기 위한 저장소.
 * 전체 projectData 대신 "서버에서 복구 가능한 메타 + 편집 중이던 한글 본문" 만 저장한다
 * (사진 / children / 여행지 등은 서버 API 로 재조회되므로 로컬 persistence 불필요).
 *
 * **sessionStorage** 를 쓰는 이유:
 *  - 브라우저 탭마다 독립된 storage 이므로 두 탭에서 서로 다른 DRAFT 를 진행해도 덮어쓰기 없음.
 *  - 탭을 닫으면 날아가지만, 그 시점엔 이미 서버 DB 에 저장 돼 있고 (`step3.story` 는 onBlur
 *    시점에 PATCH 완료) "이어서 작성하기" 플로우로 복원 가능하므로 UX 손실 없음.
 */
const PROGRESS_STORAGE_KEY = 'talemory.creation.progress.v1'
/** 오래된 snapshot 무효화 — 같은 탭을 하루 이상 열어둔 뒤 새로고침한 edge case 대비. */
const PROGRESS_TTL_MS = 24 * 60 * 60 * 1000

interface CreationProgressSnapshot {
  savedAt: number
  currentStep: number
  storyId: number | null
  step3Story: string
}

function readProgressSnapshot(): CreationProgressSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(PROGRESS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CreationProgressSnapshot>
    if (
      typeof parsed.savedAt !== 'number' ||
      typeof parsed.currentStep !== 'number' ||
      typeof parsed.step3Story !== 'string'
    ) {
      return null
    }
    if (Date.now() - parsed.savedAt > PROGRESS_TTL_MS) {
      window.sessionStorage.removeItem(PROGRESS_STORAGE_KEY)
      return null
    }
    return {
      savedAt: parsed.savedAt,
      currentStep: Math.max(1, Math.min(MAX_STEP, parsed.currentStep)),
      storyId: typeof parsed.storyId === 'number' ? parsed.storyId : null,
      step3Story: parsed.step3Story,
    }
  } catch {
    return null
  }
}

function writeProgressSnapshot(snapshot: Omit<CreationProgressSnapshot, 'savedAt'>): void {
  if (typeof window === 'undefined') return
  try {
    const payload: CreationProgressSnapshot = { ...snapshot, savedAt: Date.now() }
    window.sessionStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota exceeded 등 무시 — 핵심 기능 차단 X */
  }
}

/**
 * 진행 snapshot 제거. 스토리 발행(publish) / 명시적 리셋 시점에 호출해
 * 같은 탭에서 과거 DRAFT 가 남지 않도록 정리. sessionStorage 라 탭을 닫으면
 * 자동 소멸되지만, 같은 탭 내에서 새 스토리 시작 시 명시 초기화가 필요하므로
 * hook return 으로 노출한다.
 */
function clearProgressSnapshot(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(PROGRESS_STORAGE_KEY)
}

const DEFAULT_DATA: StoryProject = {
  step1: {
    children: [{ name: '', gender: '남자', age: '' }],
    companions: '',
    level: '초급',
    travelDates: [],
    location: '',
  },
  step2: { photos: [], prompt: '' },
  step3: { story: '' },
  step4: { pages: DEFAULT_STORYBOARD_PAGES },
  step5: { style: 'watercolor' },
  step6: { voiceModel: null },
}

export interface UseStoryCreationFlowResult {
  currentStep: number
  projectData: StoryProject
  /** POST /api/stories 성공 후 set. step 2~8 에서 리소스 FK 로 사용. */
  storyId: number | null
  setCurrentStep: (step: number) => void
  handleNext: () => void
  handlePrev: () => void
  setStoryId: (id: number | null) => void
  updateStep1: <K extends keyof StoryProject['step1']>(key: K, value: StoryProject['step1'][K]) => void
  updateStep2: <K extends keyof StoryProject['step2']>(key: K, value: StoryProject['step2'][K]) => void
  updateStoryText: (story: string) => void
  updateStoryboardPage: (idx: number, patch: Partial<StoryboardPageDraft>) => void
  updateStyle: (style: StoryProject['step5']['style']) => void
  updateVoiceModel: (voiceModel: string | null) => void
  updateChildAt: (index: number, patch: Partial<StoryChild>) => void
  addChild: () => void
  /** 기존 person 정보를 가져와 새 row 로 append. 드롭다운 "저장된 아이 불러오기" 용. */
  appendChild: (child: StoryChild) => void
  removeChildAt: (index: number) => void
  /** 로컬 진행 상태를 날린다. publish / "새로 시작하기" 시점에 호출 예정. */
  resetProgress: () => void
}

/**
 * `useStoryCreationFlow` 초기 진입 옵션.
 * "이어서 작성하기" 플로우에서 서버 DRAFT 를 rehydrate 한 값을 주입하기 위함.
 * 미제공 시 기존 동작 그대로 (step1 부터 빈 state).
 */
export interface UseStoryCreationFlowInit {
  /** 서버 DRAFT storyId. 첫 BasicInfoStep 진입부터 PATCH 모드로 동작. */
  storyId?: number | null
  /** 서버 DRAFT 에서 복원한 step1 필드. */
  step1?: StoryProject['step1']
}

/**
 * 스토리 제작 워크스페이스의 현재 step + projectData 를 한 묶음으로 관리.
 *
 * NOTE: 프론트 목업 단계에서는 persistence 가 오히려 버그(이전 세션의 stale step 으로 진입)를
 * 유발해서 제거한다. 마운트 시 항상 step 1 + DEFAULT_DATA 로 시작하며,
 * 레거시 localStorage key 가 남아있다면 한 번 정리해준다.
 *
 * `init` 으로 서버 DRAFT rehydrate 값을 주입하면 초기 state 로 사용된다 (이후에는 로컬 편집).
 */
export function useStoryCreationFlow(init?: UseStoryCreationFlowInit): UseStoryCreationFlowResult {
  // `init` (서버 DRAFT rehydrate) 이 있으면 그것이 최우선. 없으면 localStorage snapshot 으로 복구.
  // snapshot 이 없으면 초기 상태 (step 1, 빈 데이터).
  const restored = init ? null : readProgressSnapshot()

  const [currentStep, setCurrentStepState] = useState<number>(restored?.currentStep ?? 1)
  const [projectData, setStoryProject] = useState<StoryProject>(() => {
    const base = init?.step1 ? { ...DEFAULT_DATA, step1: init.step1 } : DEFAULT_DATA
    if (restored?.step3Story) {
      return { ...base, step3: { story: restored.step3Story } }
    }
    return base
  })
  /** BasicInfoStep 에서 POST /api/stories 성공 후 set 되며 step 2~8 의 FK 로 사용. */
  const [storyId, setStoryIdState] = useState<number | null>(
    init?.storyId ?? restored?.storyId ?? null,
  )

  // 레거시 키 정리 (과거 빌드에서 남겼을 수 있는 stale draft 삭제).
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_STEP)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_DATA)
  }, [])

  // currentStep / storyId / step3.story 변경 시마다 snapshot 갱신.
  // step 1 + storyId=null + 빈 story 인 "아무것도 안 한 상태" 는 저장할 이유 없어 건너뜀.
  useEffect(() => {
    const meaningful = currentStep > 1 || storyId !== null || projectData.step3.story.length > 0
    if (meaningful) {
      writeProgressSnapshot({
        currentStep,
        storyId,
        step3Story: projectData.step3.story,
      })
    }
  }, [currentStep, storyId, projectData.step3.story])

  const setCurrentStep = useCallback((step: number) => {
    setCurrentStepState(Math.max(1, Math.min(MAX_STEP, step)))
  }, [])

  const handleNext = useCallback(() => {
    setCurrentStepState(prev => (prev < MAX_STEP ? prev + 1 : prev))
  }, [])

  const handlePrev = useCallback(() => {
    setCurrentStepState(prev => (prev > 1 ? prev - 1 : prev))
  }, [])

  const updateStep1 = useCallback(
    <K extends keyof StoryProject['step1']>(key: K, value: StoryProject['step1'][K]) => {
      setStoryProject(prev => ({ ...prev, step1: { ...prev.step1, [key]: value } }))
    },
    [],
  )

  const updateStep2 = useCallback(
    <K extends keyof StoryProject['step2']>(key: K, value: StoryProject['step2'][K]) => {
      setStoryProject(prev => ({ ...prev, step2: { ...prev.step2, [key]: value } }))
    },
    [],
  )

  const updateStoryText = useCallback((story: string) => {
    setStoryProject(prev => ({ ...prev, step3: { story } }))
  }, [])

  const updateStoryboardPage = useCallback((idx: number, patch: Partial<StoryboardPageDraft>) => {
    setStoryProject(prev => {
      const pages = [...prev.step4.pages]
      if (!pages[idx]) return prev
      pages[idx] = { ...pages[idx], ...patch }
      return { ...prev, step4: { pages } }
    })
  }, [])

  const updateStyle = useCallback((style: StoryProject['step5']['style']) => {
    setStoryProject(prev => ({ ...prev, step5: { style } }))
  }, [])

  const updateVoiceModel = useCallback((voiceModel: string | null) => {
    setStoryProject(prev => ({ ...prev, step6: { voiceModel } }))
  }, [])

  const updateChildAt = useCallback((index: number, patch: Partial<StoryChild>) => {
    setStoryProject(prev => {
      const children = [...prev.step1.children]
      children[index] = { ...children[index], ...patch }
      return { ...prev, step1: { ...prev.step1, children } }
    })
  }, [])

  const addChild = useCallback(() => {
    setStoryProject(prev => ({
      ...prev,
      step1: {
        ...prev.step1,
        children: [...prev.step1.children, { name: '', gender: '남자', age: '' }],
      },
    }))
  }, [])

  const appendChild = useCallback((child: StoryChild) => {
    setStoryProject(prev => ({
      ...prev,
      step1: {
        ...prev.step1,
        children: [...prev.step1.children, child],
      },
    }))
  }, [])

  const setStoryId = useCallback((id: number | null) => {
    setStoryIdState(id)
  }, [])

  const removeChildAt = useCallback((index: number) => {
    setStoryProject(prev => {
      const children = prev.step1.children.filter((_, i) => i !== index)
      return {
        ...prev,
        step1: {
          ...prev.step1,
          children: children.length > 0 ? children : [{ name: '', gender: '남자', age: '' }],
        },
      }
    })
  }, [])

  const resetProgress = useCallback(() => {
    clearProgressSnapshot()
  }, [])

  return {
    currentStep,
    projectData,
    storyId,
    setCurrentStep,
    handleNext,
    handlePrev,
    setStoryId,
    updateStep1,
    updateStep2,
    updateStoryText,
    updateStoryboardPage,
    updateStyle,
    updateVoiceModel,
    updateChildAt,
    addChild,
    appendChild,
    removeChildAt,
    resetProgress,
  }
}
