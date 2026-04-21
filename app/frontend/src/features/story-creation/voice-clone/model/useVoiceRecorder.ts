import { useCallback, useEffect, useRef, useState } from 'react'

export type RecordingStatus = 'idle' | 'recording' | 'ready'

export interface UseVoiceRecorderResult {
  status: RecordingStatus
  statusLabel: string
  audioUrl: string | null
  start: () => Promise<void>
  stop: () => void
  reset: () => void
  error: string | null
}

/**
 * MediaRecorder 기반 음성 녹음 훅.
 * - webm audio blob → object URL 생성
 * - reset 시 이전 URL revoke
 * - 브라우저 권한 거부/MediaRecorder 미지원 시 error 셋
 *
 * 저장(localStorage) + TTS 호출은 상위 컴포넌트가 audioUrl 을 갖고 처리.
 */
export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const rec = new MediaRecorder(stream)
      recorderRef.current = rec

      rec.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(prev => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
          return url
        })
        cleanupStream()
      }
      rec.start()
      setStatus('recording')
    } catch (err) {
      setError(err instanceof Error ? err.message : '마이크 접근이 거부되었어요.')
      setStatus('idle')
      cleanupStream()
    }
  }, [cleanupStream])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    setStatus('ready')
  }, [])

  const reset = useCallback(() => {
    setAudioUrl(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return null
    })
    setStatus('idle')
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      cleanupStream()
      setAudioUrl(prev => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [cleanupStream])

  const statusLabel =
    status === 'recording' ? '녹음 중...' : status === 'ready' ? '녹음 완료' : '대기 중'

  return { status, statusLabel, audioUrl, start, stop, reset, error }
}
