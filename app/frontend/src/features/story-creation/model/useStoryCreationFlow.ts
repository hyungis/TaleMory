import { useCallback, useEffect, useState } from 'react'
import type { ChildInfo, ProjectData } from './types'
import { MAX_STEP } from './types'
import { DEFAULT_STORY_TEXT, DEFAULT_STORYBOARD_PAGES } from '../storyboard-editor/lib/defaults'

const STORAGE_KEY_STEP = 'talemory_draft_step'
const STORAGE_KEY_DATA = 'talemory_draft_project'

const DEFAULT_DATA: ProjectData = {
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

function loadInitialStep(): number {
  if (typeof window === 'undefined') return 1
  const saved = window.localStorage.getItem(STORAGE_KEY_STEP)
  const parsed = saved ? parseInt(saved, 10) : NaN
  // 신규 제작 플로우는 step 1 부터 시작 (step 0 = 책장 대시보드는 bookstore 씬에서 처리)
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_STEP ? parsed : 1
}

function loadInitialData(): ProjectData {
  if (typeof window === 'undefined') return DEFAULT_DATA
  const saved = window.localStorage.getItem(STORAGE_KEY_DATA)
  if (!saved) return DEFAULT_DATA
  try {
    const parsed = JSON.parse(saved) as Partial<ProjectData>
    return {
      step1: {
        ...DEFAULT_DATA.step1,
        ...(parsed.step1 ?? {}),
        children: Array.isArray(parsed.step1?.children)
          ? (parsed.step1?.children as ChildInfo[])
          : DEFAULT_DATA.step1.children,
      },
      step2: { ...DEFAULT_DATA.step2, ...(parsed.step2 ?? {}) },
      step3: { ...DEFAULT_DATA.step3, ...(parsed.step3 ?? {}) },
      step4: { ...DEFAULT_DATA.step4, ...(parsed.step4 ?? {}) },
      step5: { ...DEFAULT_DATA.step5, ...(parsed.step5 ?? {}) },
      step6: { ...DEFAULT_DATA.step6, ...(parsed.step6 ?? {}) },
    }
  } catch {
    return DEFAULT_DATA
  }
}

export interface UseStoryCreationFlowResult {
  currentStep: number
  projectData: ProjectData
  setCurrentStep: (step: number) => void
  handleNext: () => void
  handlePrev: () => void
  updateStep1: <K extends keyof ProjectData['step1']>(key: K, value: ProjectData['step1'][K]) => void
  updateStep2: <K extends keyof ProjectData['step2']>(key: K, value: ProjectData['step2'][K]) => void
  updateStoryText: (story: string) => void
  updateStyle: (style: ProjectData['step5']['style']) => void
  updateChildAt: (index: number, patch: Partial<ChildInfo>) => void
  addChild: () => void
  removeChildAt: (index: number) => void
}

/**
 * 스토리 제작 워크스페이스의 현재 step + projectData 를 한 묶음으로 관리.
 * localStorage 에 자동 저장 (원본 App.jsx 동작 유지). 페이지 새로고침 후에도 draft 복원.
 */
export function useStoryCreationFlow(): UseStoryCreationFlowResult {
  const [currentStep, setCurrentStepState] = useState<number>(() => loadInitialStep())
  const [projectData, setProjectData] = useState<ProjectData>(() => loadInitialData())

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY_STEP, String(currentStep))
  }, [currentStep])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(projectData))
  }, [projectData])

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
    <K extends keyof ProjectData['step1']>(key: K, value: ProjectData['step1'][K]) => {
      setProjectData(prev => ({ ...prev, step1: { ...prev.step1, [key]: value } }))
    },
    [],
  )

  const updateStep2 = useCallback(
    <K extends keyof ProjectData['step2']>(key: K, value: ProjectData['step2'][K]) => {
      setProjectData(prev => ({ ...prev, step2: { ...prev.step2, [key]: value } }))
    },
    [],
  )

  const updateStoryText = useCallback((story: string) => {
    setProjectData(prev => ({ ...prev, step3: { story } }))
  }, [])

  const updateStyle = useCallback((style: ProjectData['step5']['style']) => {
    setProjectData(prev => ({ ...prev, step5: { style } }))
  }, [])

  const updateChildAt = useCallback((index: number, patch: Partial<ChildInfo>) => {
    setProjectData(prev => {
      const children = [...prev.step1.children]
      children[index] = { ...children[index], ...patch }
      return { ...prev, step1: { ...prev.step1, children } }
    })
  }, [])

  const addChild = useCallback(() => {
    setProjectData(prev => ({
      ...prev,
      step1: {
        ...prev.step1,
        children: [...prev.step1.children, { name: '', gender: '남자', age: '' }],
      },
    }))
  }, [])

  const removeChildAt = useCallback((index: number) => {
    setProjectData(prev => {
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
    updateStyle,
    updateChildAt,
    addChild,
    removeChildAt,
  }
}
