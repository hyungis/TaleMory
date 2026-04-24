import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_TTS_TEXT,
  TTS_API_BASE,
  TTS_API_URL,
  TTS_STORAGE_KEY,
  VOICE_SAMPLE_SCRIPT,
  VOICE_STORAGE_KEY,
} from './voiceDefaults'

/**
 * 마이페이지 목소리 추가 전용 훅.
 * 동화 생성 플로우의 `features/story-creation/voice-clone/model/useVoiceClone.ts` 에서
 * 복사 — localStorage 키만 분리되어 두 플로우가 서로 간섭하지 않음.
 *
 * 기능:
 *  - 녹음 (MediaRecorder → dataURL)
 *  - 기존 음성 localStorage 에서 불러오기
 *  - TTS 미리듣기 (멀티파트 POST → download_url fetch → dataURL 로 재생)
 *  - 커스텀 오디오 플레이어 (play/pause + seek + 현재/총 시간)
 *  - 제목 + 저장 (VOICE_STORAGE_KEY + TTS_STORAGE_KEY)
 *  - 저장 상태 요약 문구
 */

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
  status: RecordingStatus
  statusLabel: string
  recordedAudioUrl: string | null
  ttsAudioUrl: string | null
  ttsText: string
  setTtsText: (value: string) => void
  ttsStatusText: string
  isTtsLoading: boolean
  voiceTitle: string
  setVoiceTitle: (value: string) => void
  savedVoiceSummary: string
  audioRef: React.RefObject<HTMLAudioElement | null>
  isAudioPlaying: boolean
  audioCurrentTime: number
  audioDuration: number
  setAudioDuration: (value: number) => void
  setAudioCurrentTime: (value: number) => void
  setIsAudioPlaying: (value: boolean) => void
  toggleAudioPlayback: () => void
  seekAudio: (percent: number) => void
  startRecording: () => Promise<void>
  stopRecording: () => void
  rerecord: () => void
  loadExistingVoice: () => void
  previewTts: () => Promise<void>
  saveVoiceRecording: () => string | null
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
  const mime = parts[0].match(/:(.*?);/)?.[1] ?? 'audio/webm'
  const binary = atob(parts[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function useVoiceClone(): UseVoiceCloneResult {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [statusLabel, setStatusLabel] = useState('대기 중')
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null)
  const [ttsText, setTtsText] = useState(DEFAULT_TTS_TEXT)
  const [ttsStatusText, setTtsStatusText] = useState(
    '녹음하거나 기존 음성을 불러오면 TTS를 만들 수 있어요.',
  )
  const [isTtsLoading, setIsTtsLoading] = useState(false)
  const [voiceTitle, setVoiceTitle] = useState('')
  const [savedVoiceSummary, setSavedVoiceSummary] = useState('아직 저장된 음성이 없습니다.')

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
          `저장된 TTS: ${savedTts.title}. 마이페이지 목소리 목록에 추가되었습니다.`,
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

  useEffect(() => {
    updateSavedVoiceSummary()
  }, [updateSavedVoiceSummary])

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      recorderRef.current = rec
      chunksRef.current = []

      rec.ondataavailable = (e) => {
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

  const loadExistingVoice = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(VOICE_STORAGE_KEY)
      const saved = raw ? (JSON.parse(raw) as SavedVoiceRecord) : null
      if (saved?.audio) {
        setRecordedAudioUrl(saved.audio)
        setVoiceTitle(saved.name || '')
        setStatus('ready')
        setStatusLabel('기존 음성 불러옴')
        setTtsStatusText('기존 음성으로 TTS를 만들 수 있어요.')
      } else {
        setStatus('idle')
        setStatusLabel('저장된 음성 없음')
        setTtsStatusText('녹음하거나 기존 음성을 불러오면 TTS를 만들 수 있어요.')
      }
      updateSavedVoiceSummary()
    } catch {
      alert('저장된 음성을 불러오지 못했습니다.')
    }
  }, [updateSavedVoiceSummary])

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

  const saveVoiceRecording = useCallback((): string | null => {
    const name = voiceTitle.trim()
    if (!name) {
      setStatus('idle')
      setStatusLabel('제목 먼저 입력')
      return null
    }
    try {
      if (recordedAudioUrl) {
        const record: SavedVoiceRecord = {
          name,
          audio: recordedAudioUrl,
          savedAt: new Date().toISOString(),
        }
        window.localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(record))
      }
      if (ttsAudioUrl) {
        const record: SavedTtsRecord = {
          title: name,
          text: ttsText.trim(),
          audio: ttsAudioUrl,
          savedAt: new Date().toISOString(),
        }
        window.localStorage.setItem(TTS_STORAGE_KEY, JSON.stringify(record))
        setStatusLabel('TTS 음성 저장 완료')
      } else {
        setStatusLabel('녹음 저장 완료')
      }
      setStatus('ready')
      updateSavedVoiceSummary()
      return name
    } catch {
      alert('저장 용량이 초과되었습니다. 녹음이 너무 길 수 있어요.')
      return null
    }
  }, [voiceTitle, recordedAudioUrl, ttsAudioUrl, ttsText, updateSavedVoiceSummary])

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

  useEffect(() => () => cleanupStream(), [cleanupStream])

  return {
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
  const s = Math.floor(t % 60)
    .toString()
    .padStart(2, '0')
  return `${m}:${s}`
}
