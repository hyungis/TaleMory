import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isApiError } from '../../../../shared/api'
import type { VoiceProfileId } from '../../../../shared/types'
import { createVoiceProfile } from '../api/createVoiceProfile'
import { getVoiceProfiles } from '../api/getVoiceProfiles'

export type RecordingStatus = 'idle' | 'recording' | 'ready'

export interface UseVoiceCloneResult {
  status: RecordingStatus
  statusLabel: string
  recordedAudioUrl: string | null
  isSaving: boolean
  voiceTitle: string
  setVoiceTitle: (value: string) => void
  savedVoiceSummary: string
  audioRef: RefObject<HTMLAudioElement | null>
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
  loadExistingVoice: () => Promise<void>
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
  const [meta = '', data = ''] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'audio/webm'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Blob([bytes], { type: mime })
}

const audioUrlToBlob = async (audioUrl: string): Promise<Blob> => {
  if (audioUrl.startsWith('data:')) return dataUrlToBlob(audioUrl)

  const response = await fetch(audioUrl)
  if (!response.ok) throw new Error(`Audio fetch failed: ${response.status}`)
  return response.blob()
}

function getVoiceSaveErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.message
  if (error instanceof Error) return error.message
  return '목소리 저장에 실패했습니다. 다시 시도해 주세요.'
}

export function useVoiceClone(): UseVoiceCloneResult {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [statusLabel, setStatusLabel] = useState('대기 중')
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [voiceTitle, setVoiceTitle] = useState('')
  const [savedVoiceSummary, setSavedVoiceSummary] = useState('아직 저장된 목소리가 없습니다.')
  const [savedProfileId, setSavedProfileId] = useState<VoiceProfileId | null>(null)

  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const refreshSavedVoiceSummary = useCallback(async () => {
    try {
      const profiles = await getVoiceProfiles()
      const latest = profiles[0]
      setSavedVoiceSummary(
        latest ? `저장된 보이스: ${latest.title}` : '아직 저장된 목소리가 없습니다.',
      )
    } catch {
      setSavedVoiceSummary('저장된 목소리 정보를 불러오지 못했습니다.')
    }
  }, [])

  useEffect(() => {
    void refreshSavedVoiceSummary()
  }, [refreshSavedVoiceSummary])

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = await blobToDataUrl(blob)
        setRecordedAudioUrl(url)
        setStatus('ready')
        setStatusLabel('녹음이 완료되었어요')
        cleanupStream()
      }

      recorder.start()
      setStatus('recording')
      setStatusLabel('녹음 중')
    } catch {
      setStatus('idle')
      setStatusLabel('마이크 권한 필요')
      cleanupStream()
    }
  }, [cleanupStream])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const rerecord = useCallback(() => {
    setRecordedAudioUrl(null)
    setStatus('idle')
    setStatusLabel('다시 녹음 준비')
    setIsAudioPlaying(false)
    setAudioCurrentTime(0)
    setAudioDuration(0)
  }, [])

  const loadExistingVoice = useCallback(async () => {
    try {
      const profiles = await getVoiceProfiles()
      const latest = profiles[0]

      if (!latest) {
        setStatus('idle')
        setStatusLabel('저장된 목소리 없음')
        setSavedVoiceSummary('아직 저장된 목소리가 없습니다.')
        return
      }

      setRecordedAudioUrl(latest.audioUrl || null)
      setVoiceTitle(latest.title)
      setSavedProfileId(latest.id)
      setStatus('ready')
      setStatusLabel('기존 목소리 불러옴')
      setSavedVoiceSummary(`저장된 보이스: ${latest.title}`)
    } catch {
      alert('저장된 목소리를 불러오지 못했습니다.')
    }
  }, [])

  const saveVoiceRecording = useCallback(async (): Promise<string | null> => {
    const title = voiceTitle.trim()

    if (!title) {
      setStatus('idle')
      setStatusLabel('제목 먼저 입력')
      return null
    }

    if (!recordedAudioUrl) {
      setStatusLabel('녹음 먼저 필요')
      return null
    }

    setIsSaving(true)

    try {
      const audioBlob = await audioUrlToBlob(recordedAudioUrl)
      const profile = await createVoiceProfile({ title, audioBlob })

      setSavedProfileId(profile.id)
      setStatus('ready')
      setStatusLabel('서버 저장 완료')
      setSavedVoiceSummary(`저장된 보이스: ${profile.title}`)
      await queryClient.invalidateQueries({ queryKey: ['voiceProfiles'] })
      await queryClient.invalidateQueries({ queryKey: ['voiceProfile', profile.id] })
      return profile.title
    } catch (error) {
      const message = getVoiceSaveErrorMessage(error)
      setStatusLabel('저장 실패')
      alert(message)
      return null
    } finally {
      setIsSaving(false)
    }
  }, [voiceTitle, recordedAudioUrl, queryClient])

  const toggleAudioPlayback = useCallback(() => {
    const element = audioRef.current
    if (!element || !element.src) return

    if (element.paused) void element.play()
    else element.pause()
  }, [])

  const seekAudio = useCallback((percent: number) => {
    const element = audioRef.current
    if (!element || !element.duration) return

    element.currentTime = (percent / 100) * element.duration
    setAudioCurrentTime(element.currentTime)
  }, [])

  // savedProfileId is exposed indirectly via savedVoiceSummary; suppress unused-var lint by reading it.
  void savedProfileId

  useEffect(() => () => cleanupStream(), [cleanupStream])

  return {
    status,
    statusLabel,
    recordedAudioUrl,
    isSaving,
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
    saveVoiceRecording,
  }
}

export function formatAudioTime(time: number): string {
  if (!Number.isFinite(time)) return '0:00'

  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, '0')

  return `${minutes}:${seconds}`
}
