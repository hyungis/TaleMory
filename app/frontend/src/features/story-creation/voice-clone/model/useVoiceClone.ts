import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_TTS_TEXT,
  TTS_STORAGE_KEY,
  VOICE_SAMPLE_SCRIPT,
  VOICE_STORAGE_KEY,
} from '../lib/defaults'
import {
  presignVoiceUpload,
  uploadAudioToS3,
  commitVoiceProfile,
  getVoiceProfiles,
  getRecordingScript,
  postVoicePreview,
  getVoicePreview,
  attachVoiceProfileToStory,
  type VoiceProfileDto,
} from '../api/voiceProfileApi'
import type { StoryId, VoiceProfileId } from '../../../../shared/types'

export type RecordingStatus = 'idle' | 'recording' | 'ready'

/**
 * voice profile ↔ story 연결(attach) 진행 상태.
 * - 'idle'      : 아직 시도 안 함 (savedProfileId === null)
 * - 'attaching' : 시도 중 (retry 포함)
 * - 'attached'  : 성공
 * - 'failed'    : 모든 retry 소진 후 실패 — UI 가 inline 에러 + 재시도 버튼 노출
 */
export type AttachStatus = 'idle' | 'attaching' | 'attached' | 'failed'

interface SavedVoiceRecord {
  name: string
  audio: string
  savedAt: string
}
interface SavedTtsRecord {
  title: string
  text: string
  audio: string
  savedAt: string
}

export interface UseVoiceCloneResult {
  // 녹음 스크립트 (서버에서 아이 이름 주입)
  sampleScript: string

  // 녹음 상태
  status: RecordingStatus
  statusLabel: string

  // 오디오 리소스 (dataURL 형태)
  recordedAudioUrl: string | null
  ttsAudioUrl: string | null

  // 서버 저장 결과
  savedProfileId: VoiceProfileId | null
  isSaving: boolean

  // story attach 상태
  attachStatus: AttachStatus
  attachError: string | null
  retryAttach: () => Promise<void>

  // TTS 입력
  ttsText: string
  setTtsText: (value: string) => void
  ttsStatusText: string
  isTtsLoading: boolean

  // 저장 입력
  voiceTitle: string
  setVoiceTitle: (value: string) => void
  savedVoiceSummary: string

  // 재생 컨트롤
  audioRef: React.RefObject<HTMLAudioElement | null>
  isAudioPlaying: boolean
  audioCurrentTime: number
  audioDuration: number
  setAudioDuration: (value: number) => void
  setAudioCurrentTime: (value: number) => void
  setIsAudioPlaying: (value: boolean) => void
  toggleAudioPlayback: () => void
  seekAudio: (percent: number) => void

  /**
   * 현재 녹음 중인 경과 시간 (초). status === 'recording' 동안 1 초 간격 tick.
   * 녹음 중이 아닐 때(idle / ready)는 0 으로 초기화돼 UI 가 표시 안 함.
   */
  recordingElapsed: number

  // 액션
  startRecording: () => Promise<void>
  stopRecording: () => void
  rerecord: () => void
  /**
   * 저장된 보이스 프로필 목록 조회 — "기존 음성 불러오기" 모달이 사용.
   * BE `/voice-profiles` GET 결과를 그대로 반환. 모달이 list 표시 + 선택 UI 담당.
   */
  fetchVoiceProfiles: () => Promise<VoiceProfileDto[]>
  /**
   * 모달에서 사용자가 선택한 보이스 프로필 한 건을 active 상태로 로드 + 현재 story 에 attach.
   * - audioUrl 이 있으면 player 에 세팅
   * - savedProfileId 갱신
   * - statusLabel/savedVoiceSummary 동기화
   * - 진행 중 녹음 타이머가 남아있으면 정리 (방어)
   */
  loadVoiceProfile: (profile: VoiceProfileDto) => Promise<void>
  previewTts: () => Promise<void>
  /**
   * 사용자가 입력한 제목으로 녹음을 BE 에 commit.
   * - 빈/공백 제목은 거부 (UI 모달에서 1차 검증, 여기서 2차 방어).
   * - 성공 시 commit 한 title 을 반환 → 호출부가 onVoiceSaved 콜백에 사용.
   */
  saveVoiceRecording: (title: string) => Promise<string | null>
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('FileReader did not return a string'))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',')
  const mime = (parts[0].match(/:(.*?);/)?.[1]) ?? 'audio/webm'
  const binary = atob(parts[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * 보이스 클론 전체 상태 + 동작을 한 훅에 통합.
 *
 * 기능:
 *  - 녹음 (MediaRecorder → dataURL)
 *  - 기존 음성 localStorage 에서 불러오기
 *  - TTS 미리듣기 (멀티파트 POST → download_url fetch → dataURL 로 재생)
 *  - 커스텀 오디오 플레이어 (play/pause + seek + 현재/총 시간)
 *  - 제목 + 저장 (VOICE_STORAGE_KEY + TTS_STORAGE_KEY)
 *  - 저장 상태 요약 문구
 */
export function useVoiceClone(storyId?: StoryId | null): UseVoiceCloneResult {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [statusLabel, setStatusLabel] = useState('대기 중')
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [sampleScript, setSampleScript] = useState(VOICE_SAMPLE_SCRIPT)
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null)
  const [ttsText, setTtsText] = useState(DEFAULT_TTS_TEXT)
  const [ttsStatusText, setTtsStatusText] = useState(
    '녹음하거나 기존 음성을 불러오면 TTS를 만들 수 있어요.',
  )
  const [isTtsLoading, setIsTtsLoading] = useState(false)
  const [voiceTitle, setVoiceTitle] = useState('')
  const [savedVoiceSummary, setSavedVoiceSummary] = useState('아직 저장된 음성이 없습니다.')
  const [savedProfileId, setSavedProfileId] = useState<VoiceProfileId | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [attachStatus, setAttachStatus] = useState<AttachStatus>('idle')
  const [attachError, setAttachError] = useState<string | null>(null)

  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // 녹음 경과 시간 — 녹음 중에만 1 초 간격 tick. start 시점을 ref 로 보관해
  // setInterval 의 closure stale state 문제를 우회 (Date.now() 기반 정확한 누적).
  const [recordingElapsed, setRecordingElapsed] = useState(0)
  const recordingStartedAtRef = useRef<number | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    recordingStartedAtRef.current = null
  }, [])

  const updateSavedVoiceSummary = useCallback(() => {
    try {
      const savedVoiceRaw = window.localStorage.getItem(VOICE_STORAGE_KEY)
      const savedTtsRaw = window.localStorage.getItem(TTS_STORAGE_KEY)
      const savedVoice = savedVoiceRaw ? (JSON.parse(savedVoiceRaw) as SavedVoiceRecord) : null
      const savedTts = savedTtsRaw ? (JSON.parse(savedTtsRaw) as SavedTtsRecord) : null
      if (savedTts) {
        setSavedVoiceSummary(
          `저장된 TTS: ${savedTts.title}. 완성본에서 이 음성을 사용할 수 있어요.`,
        )
      } else if (savedVoice) {
        setSavedVoiceSummary(
          `저장된 보이스: ${savedVoice.name}. TTS 들어보기 후 제목과 함께 저장하세요.`,
        )
      } else {
        setSavedVoiceSummary('아직 저장된 음성이 없습니다.')
      }
    } catch {
      setSavedVoiceSummary('아직 저장된 음성이 없습니다.')
    }
  }, [])

  // 마운트 + 저장 변경 시 요약 갱신
  useEffect(() => {
    updateSavedVoiceSummary()
  }, [updateSavedVoiceSummary])

  // 서버에서 녹음 스크립트 가져오기 (아이 이름 주입)
  useEffect(() => {
    getRecordingScript(storyId).then(setSampleScript).catch(() => {
      // 실패 시 기본 스크립트 유지
    })
  }, [storyId])

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  /**
   * voice profile 을 현재 story 에 묶는다 — transient 실패 흡수용 retry 포함.
   *
   * Step 6 의 commit / load 직후 호출되어 stories.voice_profile_id 를 채워야
   * Step 7 → 8 confirm 가드(409 INVALID_STORY_STATE)를 통과한다.
   *
   * 실패 처리:
   *  - 1차 시도 + 2회 retry (총 3회), 200ms / 600ms 지수 백오프
   *  - 최종 실패 시 attachStatus='failed' + attachError 세팅 → UI 가 다음 버튼을
   *    막고 inline 에러 + 재시도 버튼 노출 (10분 녹음 후 confirm 에서 발견되는 것 방지).
   */
  const tryAttachToStory = useCallback(async (voiceProfileId: VoiceProfileId) => {
    if (!storyId) return
    setAttachStatus('attaching')
    setAttachError(null)
    const delays = [0, 200, 600]
    let lastError: unknown = null
    for (const delay of delays) {
      if (delay > 0) await new Promise(r => setTimeout(r, delay))
      try {
        await attachVoiceProfileToStory(storyId, voiceProfileId)
        setAttachStatus('attached')
        setAttachError(null)
        return
      } catch (err) {
        lastError = err
      }
    }
    const message = lastError instanceof Error
      ? lastError.message
      : '음성을 동화에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'
    console.warn('attachVoiceProfileToStory failed after retries:', lastError)
    setAttachStatus('failed')
    setAttachError(message)
  }, [storyId])

  /** "다시 연결" 버튼이 호출 — 가장 최근 savedProfileId 로 재시도. */
  const retryAttach = useCallback(async () => {
    if (savedProfileId === null) return
    await tryAttachToStory(savedProfileId)
  }, [savedProfileId, tryAttachToStory])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      recorderRef.current = rec
      chunksRef.current = []

      rec.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = async () => {
        stopRecordingTimer()
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = await blobToDataUrl(blob)
        setRecordedAudioUrl(url)
        setTtsAudioUrl(null)
        /* 새 녹음을 받으면 직전에 "기존 음성 불러오기" 로 채워졌거나 previewTts 가 auto-commit
           해 둔 savedProfileId 는 더 이상 이 녹음과 무관하다. 다음 previewTts 호출이 새 녹음을
           업로드하도록 reset 한다 (안 그러면 FE 가 옛날 profileId 로 TTS 호출 → 사용자가 새로
           녹음했는데도 이전 음성으로 합성됨). attach 상태도 같이 idle 로 되돌림. */
        setSavedProfileId(null)
        setAttachStatus('idle')
        setAttachError(null)
        setStatus('ready')
        setStatusLabel('새 녹음 준비 완료')
        setTtsStatusText('이 녹음으로 TTS를 미리 들어볼 수 있어요.')
        cleanupStream()
      }

      rec.start()
      setStatus('recording')
      setStatusLabel('녹음 중')

      // 녹음 시작 시점 — onstop 에서 정리. 1 초마다 경과 시간 update.
      recordingStartedAtRef.current = Date.now()
      setRecordingElapsed(0)
      recordingTimerRef.current = setInterval(() => {
        const startedAt = recordingStartedAtRef.current
        if (startedAt === null) return
        setRecordingElapsed(Math.floor((Date.now() - startedAt) / 1000))
      }, 1000)
    } catch {
      setStatus('idle')
      setStatusLabel('마이크 권한 필요')
      stopRecordingTimer()
      setRecordingElapsed(0)
      cleanupStream()
    }
  }, [cleanupStream, stopRecordingTimer])

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  const rerecord = useCallback(() => {
    setRecordedAudioUrl(null)
    setTtsAudioUrl(null)
    /* 옛 녹음/불러온 프로필과의 연결을 끊는다 — 다음 녹음의 onstop 에서도 어차피 한 번 더 reset
       되지만, idle 상태에서도 일관되게 비워두기 위해 여기서도 처리. */
    setSavedProfileId(null)
    setAttachStatus('idle')
    setAttachError(null)
    setStatus('idle')
    setStatusLabel('다시 녹음 준비')
    setTtsStatusText('새로 녹음한 뒤 TTS를 들어볼 수 있어요.')
    setIsAudioPlaying(false)
    setAudioCurrentTime(0)
    setAudioDuration(0)
    stopRecordingTimer()
    setRecordingElapsed(0)
  }, [stopRecordingTimer])

  /**
   * 모달용 — 저장된 보이스 프로필 목록 조회. 단순 fetch, 결과를 호출부가 표시.
   * 실패 시 에러를 throw 해 호출부(모달)가 인라인 에러를 표시할 수 있도록.
   */
  const fetchVoiceProfiles = useCallback(async (): Promise<VoiceProfileDto[]> => {
    return getVoiceProfiles()
  }, [])

  /**
   * 사용자가 모달에서 선택한 프로필을 로드 — 기존 자동 "최신 1개 로드" 동작을
   * 명시적인 1건 선택으로 대체.
   */
  const loadVoiceProfile = useCallback(async (profile: VoiceProfileDto): Promise<void> => {
    // 진행 중이던 녹음 타이머가 있다면 정리 (방어 — 보통 ready 상태에서 호출되지만 idle 도 가능).
    stopRecordingTimer()
    setRecordingElapsed(0)

    if (profile.audioUrl) {
      setRecordedAudioUrl(profile.audioUrl)
    }
    setVoiceTitle(profile.title || '')
    setSavedProfileId(profile.voiceProfileId)
    await tryAttachToStory(profile.voiceProfileId)
    setStatus('ready')
    setStatusLabel('기존 음성 불러옴')
    setTtsStatusText('기존 음성으로 TTS를 만들 수 있어요.')
    setSavedVoiceSummary(`불러온 보이스: ${profile.title}`)
  }, [stopRecordingTimer, tryAttachToStory])

  const previewTts = useCallback(async () => {
    if (!recordedAudioUrl) {
      setTtsStatusText('먼저 음성을 녹음하거나 불러와 주세요.')
      return
    }
    /* 이전엔 savedProfileId 가 없으면 자동 commit 해서 마이페이지에 임시 제목으로 row 가
       남는 부작용이 있었음. 이제 사용자가 "녹음 저장하기" 로 명시적으로 저장한 보이스 프로필
       (또는 "기존 음성 불러오기" 로 선택한 프로필) 이 있을 때만 미리듣기 가능. */
    if (savedProfileId === null) {
      setTtsStatusText('먼저 "녹음 저장하기" 로 보이스를 저장한 뒤 미리듣기 할 수 있어요.')
      return
    }
    const text = ttsText.trim()
    if (!text) {
      setTtsStatusText('TTS로 들어볼 문장을 입력해 주세요.')
      return
    }

    setIsTtsLoading(true)
    setTtsStatusText('보이스 클론 TTS를 만드는 중입니다…')

    try {
      // BE에 TTS 미리듣기 비동기 작업 요청
      const { previewId } = await postVoicePreview(savedProfileId, text)

      // 3초 간격 polling — 최대 5분
      const POLL_INTERVAL = 3_000
      const MAX_DURATION = 5 * 60 * 1000
      const start = Date.now()

      const pollResult = await new Promise<string>((resolve, reject) => {
        const poll = async () => {
          if (Date.now() - start > MAX_DURATION) {
            reject(new Error('TTS 생성 시간이 초과되었습니다.'))
            return
          }
          try {
            const job = await getVoicePreview(previewId)
            if (job.status === 'SUCCESS') {
              if (!job.audioUrl) {
                reject(new Error('TTS 결과에 오디오 URL이 없습니다.'))
                return
              }
              resolve(job.audioUrl)
              return
            }
            if (job.status === 'FAILED') {
              reject(new Error(job.errorMessage ?? 'TTS 생성에 실패했습니다.'))
              return
            }
            setTimeout(poll, POLL_INTERVAL)
          } catch (err) {
            reject(err)
          }
        }
        setTimeout(poll, POLL_INTERVAL)
      })

      // 결과 오디오를 dataURL로 변환하여 재생 준비
      const audioResponse = await fetch(pollResult)
      const audioBlob = await audioResponse.blob()
      const dataUrl = await blobToDataUrl(audioBlob)

      setTtsAudioUrl(dataUrl)
      setTtsStatusText('TTS가 준비됐어요. 재생해서 들어보세요.')
    } catch (err) {
      setTtsAudioUrl(null)
      const message = err instanceof Error ? err.message : 'TTS 생성에 실패했습니다.'
      setTtsStatusText(message)
    } finally {
      setIsTtsLoading(false)
    }
  }, [recordedAudioUrl, ttsText, savedProfileId])

  /**
   * 녹음 원본을 서버에 업로드한다 (3-phase, 사진 업로드와 동일 패턴).
   * Phase 1: POST /api/voice-profiles/presigned-url → presigned URL + s3Key 발급
   * Phase 2: presigned URL 로 S3 에 직접 PUT
   * Phase 3: POST /api/voice-profiles → s3Key 로 DB commit
   *
   * 제목은 사용자가 모달에서 입력 — 빈/공백 검증은 모달에서 disabled 로 1차 차단,
   * 여기서 trim 후 빈 문자열이면 null 반환으로 2차 방어.
   */
  const saveVoiceRecording = useCallback(async (title: string): Promise<string | null> => {
    if (!recordedAudioUrl) {
      setStatusLabel('녹음이 없습니다')
      return null
    }
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setStatusLabel('제목을 입력해 주세요')
      return null
    }

    setIsSaving(true)
    try {
      const audioBlob = dataUrlToBlob(recordedAudioUrl)

      // Phase 1: presign
      const presigned = await presignVoiceUpload(audioBlob.type || 'audio/webm')
      // Phase 2: S3 PUT
      await uploadAudioToS3(presigned.uploadUrl, audioBlob)
      // Phase 3: DB commit (사용자 지정 제목)
      const profile = await commitVoiceProfile(trimmedTitle, presigned.s3Key)

      setSavedProfileId(profile.voiceProfileId)
      setVoiceTitle(trimmedTitle)
      await tryAttachToStory(profile.voiceProfileId)
      setStatus('ready')
      setStatusLabel('서버에 저장 완료')
      setSavedVoiceSummary(`녹음이 저장되었습니다: ${trimmedTitle}`)
      return trimmedTitle
    } catch {
      setStatusLabel('저장 실패')
      alert('음성 저장에 실패했습니다. 다시 시도해 주세요.')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [recordedAudioUrl, tryAttachToStory])

  const toggleAudioPlayback = useCallback(() => {
    const el = audioRef.current
    if (!el || !el.src) return
    if (el.paused) void el.play()
    else el.pause()
  }, [])

  const seekAudio = useCallback((percent: number) => {
    const el = audioRef.current
    if (!el || !el.duration) return
    el.currentTime = (percent / 100) * el.duration
    setAudioCurrentTime(el.currentTime)
  }, [])

  // 언마운트 시 stream + 녹음 타이머 정리 — leak 방지.
  useEffect(
    () => () => {
      cleanupStream()
      stopRecordingTimer()
    },
    [cleanupStream, stopRecordingTimer],
  )

  return {
    sampleScript,
    status,
    statusLabel,
    recordedAudioUrl,
    ttsAudioUrl,
    ttsText,
    setTtsText,
    ttsStatusText,
    isTtsLoading,
    voiceTitle,
    setVoiceTitle,
    savedVoiceSummary,
    savedProfileId,
    isSaving,
    attachStatus,
    attachError,
    retryAttach,
    audioRef,
    isAudioPlaying,
    audioCurrentTime,
    audioDuration,
    setAudioDuration,
    setAudioCurrentTime,
    setIsAudioPlaying,
    toggleAudioPlayback,
    seekAudio,
    recordingElapsed,
    startRecording,
    stopRecording,
    rerecord,
    fetchVoiceProfiles,
    loadVoiceProfile,
    previewTts,
    saveVoiceRecording,
  }
}

export function formatAudioTime(t: number): string {
  if (!Number.isFinite(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
