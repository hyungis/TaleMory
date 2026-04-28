import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_TTS_TEXT,
  TTS_API_BASE,
  TTS_API_URL,
  TTS_STORAGE_KEY,
  VOICE_SAMPLE_SCRIPT,
  VOICE_STORAGE_KEY,
} from '../lib/defaults'
import { presignVoiceUpload, uploadAudioToS3, commitVoiceProfile, getVoiceProfiles, getRecordingScript } from '../api/voiceProfileApi'

export type RecordingStatus = 'idle' | 'recording' | 'ready'

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
  savedProfileId: number | null
  isSaving: boolean

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

  // 액션
  startRecording: () => Promise<void>
  stopRecording: () => void
  rerecord: () => void
  loadExistingVoice: () => Promise<void>
  previewTts: () => Promise<void>
  saveVoiceRecording: () => Promise<string | null>
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
export function useVoiceClone(storyId?: number | null): UseVoiceCloneResult {
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
  const [savedProfileId, setSavedProfileId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

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
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = await blobToDataUrl(blob)
        setRecordedAudioUrl(url)
        setTtsAudioUrl(null)
        setStatus('ready')
        setStatusLabel('새 녹음 준비 완료')
        setTtsStatusText('이 녹음으로 TTS를 미리 들어볼 수 있어요.')
        cleanupStream()
      }

      rec.start()
      setStatus('recording')
      setStatusLabel('녹음 중')
    } catch {
      setStatus('idle')
      setStatusLabel('마이크 권한 필요')
      cleanupStream()
    }
  }, [cleanupStream])

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  const rerecord = useCallback(() => {
    setRecordedAudioUrl(null)
    setTtsAudioUrl(null)
    setStatus('idle')
    setStatusLabel('다시 녹음 준비')
    setTtsStatusText('새로 녹음한 뒤 TTS를 들어볼 수 있어요.')
    setIsAudioPlaying(false)
    setAudioCurrentTime(0)
    setAudioDuration(0)
  }, [])

  const loadExistingVoice = useCallback(async () => {
    try {
      const profiles = await getVoiceProfiles()
      if (profiles.length > 0) {
        const latest = profiles[0]
        if (latest.audioUrl) {
          setRecordedAudioUrl(latest.audioUrl)
        }
        setVoiceTitle(latest.title || '')
        setSavedProfileId(latest.voiceProfileId)
        setStatus('ready')
        setStatusLabel('기존 음성 불러옴')
        setTtsStatusText('기존 음성으로 TTS를 만들 수 있어요.')
        setSavedVoiceSummary(`저장된 보이스: ${latest.title}`)
      } else {
        setStatus('idle')
        setStatusLabel('저장된 음성 없음')
        setTtsStatusText('녹음하거나 기존 음성을 불러오면 TTS를 만들 수 있어요.')
      }
    } catch {
      alert('저장된 음성을 불러오지 못했습니다.')
    }
  }, [])

  const previewTts = useCallback(async () => {
    if (!recordedAudioUrl) {
      setTtsStatusText('먼저 음성을 녹음하거나 불러와 주세요.')
      return
    }
    const text = ttsText.trim()
    if (!text) {
      setTtsStatusText('TTS로 들어볼 문장을 입력해 주세요.')
      return
    }

    setIsTtsLoading(true)
    setTtsStatusText('보이스 클론 TTS를 만드는 중입니다. CPU 환경에서는 시간이 걸릴 수 있어요.')

    try {
      const voiceBlob = dataUrlToBlob(recordedAudioUrl)
      const formData = new FormData()
      formData.append('text', text)
      formData.append('ref_text', VOICE_SAMPLE_SCRIPT.replaceAll('"', '').trim())
      formData.append('language', 'Auto')
      formData.append('voice', voiceBlob, 'voice.webm')

      const response = await fetch(TTS_API_URL, { method: 'POST', body: formData })
      if (!response.ok) throw new Error((await response.text()) || 'TTS 생성 실패')

      const result = (await response.json()) as { download_url: string }
      const audioResponse = await fetch(`${TTS_API_BASE}${result.download_url}`)
      const audioBlob = await audioResponse.blob()
      const dataUrl = await blobToDataUrl(audioBlob)

      setTtsAudioUrl(dataUrl)
      setTtsStatusText('TTS가 준비됐어요. 재생 후 제목을 입력하고 저장하세요.')
    } catch {
      setTtsAudioUrl(null)
      setTtsStatusText(
        `TTS 생성에 실패했습니다. ${TTS_API_BASE} 서버가 켜져 있는지 확인해 주세요.`,
      )
    } finally {
      setIsTtsLoading(false)
    }
  }, [recordedAudioUrl, ttsText])

  /**
   * 녹음 원본을 서버에 업로드한다 (3-phase, 사진 업로드와 동일 패턴).
   * Phase 1: POST /api/v1/voice-profiles/presigned-url → presigned URL + s3Key 발급
   * Phase 2: presigned URL 로 S3 에 직접 PUT
   * Phase 3: POST /api/v1/voice-profiles → s3Key 로 DB commit
   */
  const saveVoiceRecording = useCallback(async (): Promise<string | null> => {
    if (!recordedAudioUrl) {
      setStatusLabel('녹음이 없습니다')
      return null
    }

    setIsSaving(true)
    try {
      const audioBlob = dataUrlToBlob(recordedAudioUrl)
      const autoTitle = `녹음_${new Date().toISOString().slice(0, 19).replace('T', '_')}`

      // Phase 1: presign
      const presigned = await presignVoiceUpload(audioBlob.type || 'audio/webm')
      // Phase 2: S3 PUT
      await uploadAudioToS3(presigned.uploadUrl, audioBlob)
      // Phase 3: DB commit
      const profile = await commitVoiceProfile(autoTitle, presigned.s3Key)

      setSavedProfileId(profile.voiceProfileId)
      setStatus('ready')
      setStatusLabel('서버에 저장 완료')
      setSavedVoiceSummary(`녹음이 저장되었습니다. (ID: ${profile.voiceProfileId})`)
      return autoTitle
    } catch {
      setStatusLabel('저장 실패')
      alert('음성 저장에 실패했습니다. 다시 시도해 주세요.')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [recordedAudioUrl])

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

  // 언마운트 시 stream 정리
  useEffect(() => () => cleanupStream(), [cleanupStream])

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
    audioRef,
    isAudioPlaying,
    audioCurrentTime,
    audioDuration,
    setAudioDuration,
    setAudioCurrentTime,
    setIsAudioPlaying,
    toggleAudioPlayback,
    seekAudio,
    startRecording,
    stopRecording,
    rerecord,
    loadExistingVoice,
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
