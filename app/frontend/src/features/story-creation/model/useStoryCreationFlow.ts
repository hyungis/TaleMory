import { useCallback, useEffect, useState } from 'react'
import type { StoryChild, StoryProject, StoryboardPageDraft } from './types'
import { MAX_STEP } from './types'
import { DEFAULT_STORY_TEXT, DEFAULT_STORYBOARD_PAGES } from '../storyboard-editor/lib/defaults'

// 레거시 저장 키 (목업 전환 이전 버전에서 localStorage 에 남아있을 수 있어 한 번 정리해준다).
const LEGACY_STORAGE_KEY_STEP = 'talemory_draft_step'
const LEGACY_STORAGE_KEY_DATA = 'talemory_draft_project'

const DEFAULT_DATA: StoryProject = {
  step1: {
    children: [{ name: '', gender: '남자', age: '' }],
    companions: '',
    level: '초급',
    travelDates: [],
    location: '',
  },
  step2: { photos: [], prompt: '' },
  step3: { story: DEFAULT_STORY_TEXT },
  step4: { pages: DEFAULT_STORYBOARD_PAGES },
  step5: { style: 'watercolor' },
  step6: { voiceModel: null },
}

export interface UseStoryCreationFlowResult {
  currentStep: number
  projectData: StoryProject
  setCurrentStep: (step: number) => void
  handleNext: () => void
  handlePrev: () => void
  updateStep1: <K extends keyof StoryProject['step1']>(key: K, value: StoryProject['step1'][K]) => void
  updateStep2: <K extends keyof StoryProject['step2']>(key: K, value: StoryProject['step2'][K]) => void
  updateStoryText: (story: string) => void
  updateStoryboardPage: (idx: number, patch: Partial<StoryboardPageDraft>) => void
  updateStyle: (style: StoryProject['step5']['style']) => void
  updateVoiceModel: (voiceModel: string | null) => void
  updateChildAt: (index: number, patch: Partial<StoryChild>) => void
  addChild: () => void
  removeChildAt: (index: number) => void
}

/**
 * 스토리 제작 워크스페이스의 현재 step + projectData 를 한 묶음으로 관리.
 *
 * NOTE: 프론트 목업 단계에서는 persistence 가 오히려 버그(이전 세션의 stale step 으로 진입)를
 * 유발해서 제거한다. 마운트 시 항상 step 1 + DEFAULT_DATA 로 시작하며,
 * 레거시 localStorage key 가 남아있다면 한 번 정리해준다.
 */
export function useStoryCreationFlow(): UseStoryCreationFlowResult {
  const [currentStep, setCurrentStepState] = useState<number>(1)
  const [projectData, setStoryProject] = useState<StoryProject>(DEFAULT_DATA)

  // 레거시 키 정리 (과거 빌드에서 남겼을 수 있는 stale draft 삭제).
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_STEP)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_DATA)
  }, [])

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

  return {
    currentStep,
    projectData,
    setCurrentStep,
    handleNext,
    handlePrev,
    updateStep1,
    updateStep2,
    updateStoryText,
    updateStoryboardPage,
    updateStyle,
    updateVoiceModel,
    updateChildAt,
    addChild,
    removeChildAt,
  }
}
