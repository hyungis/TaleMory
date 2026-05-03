import { useCallback, useEffect, useState } from 'react'
import type { StoryChild, StoryProject, StoryboardPageDraft } from './types'
import { MAX_STEP } from './types'
import { DEFAULT_STORYBOARD_PAGES } from '../storyboard-editor/lib/defaults'
import {
  CREATION_PROGRESS_STORAGE_KEY,
  clearCreationProgressSnapshot,
} from '../lib/progressStorage'

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
 *
 * 키 정의와 clear 헬퍼는 `lib/progressStorage` 로 분리되어 있다 — BookstoreScene 등
 * 외부 진입점에서 "신규 시작" / "stale storyId 회복" 시 명시 reset 호출이 필요하기 때문.
 */
/** 오래된 snapshot 무효화 — 같은 탭을 하루 이상 열어둔 뒤 새로고침한 edge case 대비. */
const PROGRESS_TTL_MS = 24 * 60 * 60 * 1000

interface CreationProgressSnapshot {
  savedAt: number
  currentStep: number
  storyId: number | null
  step3Story: string
  /**
   * 본문(STORY) 발행이 한 번이라도 트리거된 후의 SUMMARY 잡 id.
   * 새로고침을 거쳐 Step 3 으로 돌아오는 경우에도 락을 유지하기 위해 sessionStorage 에 보존.
   * BE 의 storyboard-pages 쿼리로 페이지 존재 여부를 확인해 락을 derive 하는 1차 방어선과
   * 더불어, STORY 잡이 진행 중이라 페이지가 아직 INSERT 되지 않은 짧은 구간을 메우는 2차 안전장치.
   */
  lastConfirmedSummaryJobId: string | null
}

function readProgressSnapshot(): CreationProgressSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(CREATION_PROGRESS_STORAGE_KEY)
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
      window.sessionStorage.removeItem(CREATION_PROGRESS_STORAGE_KEY)
      return null
    }
    return {
      savedAt: parsed.savedAt,
      currentStep: Math.max(1, Math.min(MAX_STEP, parsed.currentStep)),
      storyId: typeof parsed.storyId === 'number' ? parsed.storyId : null,
      step3Story: parsed.step3Story,
      lastConfirmedSummaryJobId:
        typeof parsed.lastConfirmedSummaryJobId === 'string'
          ? parsed.lastConfirmedSummaryJobId
          : null,
    }
  } catch {
    return null
  }
}

function writeProgressSnapshot(snapshot: Omit<CreationProgressSnapshot, 'savedAt'>): void {
  if (typeof window === 'undefined') return
  try {
    const payload: CreationProgressSnapshot = { ...snapshot, savedAt: Date.now() }
    window.sessionStorage.setItem(CREATION_PROGRESS_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota exceeded 등 무시 — 핵심 기능 차단 X */
  }
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
  /**
   * Step 3 의 "스토리 확정하고 다음" 클릭으로 발행된 본문(STORY) 잡 id.
   * Step 4 가 마운트되면 이 jobId 로 폴링하여 PENDING/RUNNING 동안 "본문 생성 중" 화면을 표시.
   * 잡 종결 또는 step 1 로 돌아가면 setter 로 null 처리.
   */
  storyGenerationJobId: number | null
  /**
   * Step 5 PATCH /style 응답으로 받은 FINAL_ILLUSTRATION 잡 id (멱등 가드 시 기존 id 재사용).
   * Step 8 FinalPreviewStep 에서 TTS jobId 와 함께 동시 폴링.
   * 메모리 한정 — 새로고침 시 sessionStorage 미영속.
   */
  finalIllustrationJobId: number | null
  /**
   * 마지막으로 사용자가 "스토리 확정하고 다음" 으로 본문 발행에 사용한 SUMMARY 잡의 id (string).
   * Step 3 으로 돌아와서 confirm 다시 누를 때 이 값과 현재 summary jobId 를 비교해
   * 같으면 본문 재발행을 skip (불필요한 OpenAI 호출 + 페이지 통째 교체 방지).
   * 다르면 줄거리가 새로 만들어진 것이므로 본문 재발행 트리거.
   */
  lastConfirmedSummaryJobId: string | null
  setCurrentStep: (step: number) => void
  handleNext: () => void
  handlePrev: () => void
  setStoryId: (id: number | null) => void
  setStoryGenerationJobId: (jobId: number | null) => void
  setFinalIllustrationJobId: (jobId: number | null) => void
  setLastConfirmedSummaryJobId: (jobId: string | null) => void
  updateStep1: <K extends keyof StoryProject['step1']>(key: K, value: StoryProject['step1'][K]) => void
  updateStep2: <K extends keyof StoryProject['step2']>(key: K, value: StoryProject['step2'][K]) => void
  updateStoryText: (story: string) => void
  updateStoryboardPage: (idx: number, patch: Partial<StoryboardPageDraft>) => void
  updateStyle: (style: StoryProject['step5']['style']) => void
  updateVoiceModel: (voiceModel: string | null) => void
  updateChildAt: (index: number, patch: Partial<StoryChild>) => void
  addChild: () => void
  /**
   * 기존 person 정보를 가져와 새 row 로 prepend (배열 앞에 추가).
   * 드롭다운 "저장된 아이 불러오기" 용 — 사용자가 막 불러온 아이가 가장 위에 보이도록.
   */
  prependChild: (child: StoryChild) => void
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
  // 두 소스를 함께 활용한다:
  //  - `init` (서버 DRAFT rehydrate)        → step1 데이터(아이/여행지) 복구. "이어서 작성하기" 진입.
  //  - `snapshot` (sessionStorage)          → currentStep / storyId / step3.story 복구.
  //                                            "Step 4 같은 곳에서 새로고침 후 그 자리" 흐름.
  //
  // 핵심 보호: snapshot.storyId 와 init.storyId 가 다르면 다른 스토리로 새로 진입한 것이므로
  // 옛 진행 상태를 누수시키지 않도록 snapshot 을 무시한다.
  const snapshotRaw = readProgressSnapshot()
  const restored = (() => {
    if (!snapshotRaw) return null
    if (init?.storyId != null && init.storyId !== snapshotRaw.storyId) return null
    return snapshotRaw
  })()

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
  /**
   * Step 3 의 본문 발행 mutation 성공 시 set, Step 4 폴링 종결 또는 step 후퇴 시 null.
   * 새로고침으로 sessionStorage 에서 복원되는 다른 state 와 달리 메모리 한정 — 새로고침 후에는
   * Step 4 가 storyboard-pages 캐시 기반으로 동작 (pages.length > 0 이면 정상 표시).
   */
  const [storyGenerationJobId, setStoryGenerationJobIdState] = useState<number | null>(null)
  const [finalIllustrationJobId, setFinalIllustrationJobIdState] = useState<number | null>(null)
  /**
   * 마지막으로 본문 발행에 사용된 SUMMARY 잡 id. PromptStep 에서 confirm 시 비교 → 재발행 skip 판단.
   *
   * sessionStorage 로 영속화하는 이유:
   *  - 본문(STORY) 잡이 SUCCESS 되어 page row 가 INSERT 되기 전에 사용자가 새로고침하면,
   *    storyboard-pages 쿼리에서도 락을 derive 할 수 없게 되어 Step 3 의 줄거리 재생성을
   *    허용해버리는 race window 가 생긴다.
   *  - 이 값이 sessionStorage 에 남아있으면 그 짧은 구간에도 락이 유지된다.
   *  - 락의 1차 방어선은 BE 의 page 존재 여부 (PromptStep 의 useStoryboardPagesQuery) 이며,
   *    이 값은 본문 발행 직후 ~ page INSERT 직전 의 짧은 구간을 메우는 2차 안전장치.
   */
  const [lastConfirmedSummaryJobId, setLastConfirmedSummaryJobIdState] = useState<string | null>(
    restored?.lastConfirmedSummaryJobId ?? null,
  )

  // 레거시 키 정리 (과거 빌드에서 남겼을 수 있는 stale draft 삭제).
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_STEP)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_DATA)
  }, [])

  // currentStep / storyId / step3.story / lastConfirmedSummaryJobId 변경 시마다 snapshot 갱신.
  // step 1 + storyId=null + 빈 story + 락 미설정 인 "아무것도 안 한 상태" 는 저장할 이유 없어 건너뜀.
  useEffect(() => {
    const meaningful =
      currentStep > 1 ||
      storyId !== null ||
      projectData.step3.story.length > 0 ||
      lastConfirmedSummaryJobId !== null
    if (meaningful) {
      writeProgressSnapshot({
        currentStep,
        storyId,
        step3Story: projectData.step3.story,
        lastConfirmedSummaryJobId,
      })
    }
  }, [currentStep, storyId, projectData.step3.story, lastConfirmedSummaryJobId])

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

  /**
   * 불러온 아이를 배열 맨 앞에 추가.
   * 끝에 빈 placeholder row 가 있어도 그 위에 노출되도록 prepend → 사용자가 즉시 인식 가능.
   */
  const prependChild = useCallback((child: StoryChild) => {
    setStoryProject(prev => ({
      ...prev,
      step1: {
        ...prev.step1,
        children: [child, ...prev.step1.children],
      },
    }))
  }, [])

  const setStoryId = useCallback((id: number | null) => {
    setStoryIdState(id)
  }, [])

  const setStoryGenerationJobId = useCallback((jobId: number | null) => {
    setStoryGenerationJobIdState(jobId)
  }, [])

  const setFinalIllustrationJobId = useCallback((jobId: number | null) => {
    setFinalIllustrationJobIdState(jobId)
  }, [])

  const setLastConfirmedSummaryJobId = useCallback((jobId: string | null) => {
    setLastConfirmedSummaryJobIdState(jobId)
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
    clearCreationProgressSnapshot()
  }, [])

  return {
    currentStep,
    projectData,
    storyId,
    storyGenerationJobId,
    finalIllustrationJobId,
    lastConfirmedSummaryJobId,
    setCurrentStep,
    handleNext,
    handlePrev,
    setStoryId,
    setStoryGenerationJobId,
    setFinalIllustrationJobId,
    setLastConfirmedSummaryJobId,
    updateStep1,
    updateStep2,
    updateStoryText,
    updateStoryboardPage,
    updateStyle,
    updateVoiceModel,
    updateChildAt,
    addChild,
    prependChild,
    removeChildAt,
    resetProgress,
  }
}
