import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  Star,
  MessageSquareHeart,
} from 'lucide-react'
import type { StoryProject } from '../../model/types'
import { CreationHeader } from '../../ui/CreationHeader'
import { CreationFooter } from '../../ui/CreationFooter'
import { CreationDoodlesBg } from '../../ui/CreationDoodlesBg'
import { StepTitleBlock } from '../../ui/StepTitleBlock'
import {
  getScenes,
  presignHighlightVoice,
  uploadAudioToS3,
  commitHighlightVoice,
  deleteHighlightVoice,
  saveOutro,
  presignOutroVoice,
  commitOutroVoice,
  type SceneDto,
} from '../api/highlightOutroApi'
import { useStoryboardConfirm } from '../model/useStoryboardConfirm'
import '../../styles/creation-paper.css'

interface HighlightOutroStepProps {
  storyId?: number | null
  projectData: StoryProject
  onBack: () => void
  onNext: () => void
  setStoryGenerationJobId: (jobId: number | null) => void
}

interface HighlightSentence {
  sentenceId: number
  pageIndex: number
  sentenceIndex: number
  text: string
  audioUrl: string | null
  uploading: boolean
}

type RecordingTarget =
  | { kind: 'highlight'; pageIndex: number; sentenceIndex: number }
  | { kind: 'outro' }
  | null

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * STEP 07 — paper-craft 톤 (Claude offline.html 1:1).
 * 강조 문장 선택/녹음 + 아웃트로 멘트/녹음. 모든 백엔드 로직 그대로 보존.
 */
export function HighlightOutroStep({
  storyId,
  projectData,
  onBack,
  onNext,
  setStoryGenerationJobId,
}: HighlightOutroStepProps) {
  const { mutateAsync: confirmStoryboard, isPending: isConfirming } = useStoryboardConfirm()
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [scenes, setScenes] = useState<SceneDto[] | null>(null)
  const [loadingScenes, setLoadingScenes] = useState(false)

  useEffect(() => {
    if (!storyId) return
    setLoadingScenes(true)
    getScenes(storyId)
      .then(data => {
        if (data.length > 0) setScenes(data)
      })
      .catch(() => {})
      .finally(() => setLoadingScenes(false))
  }, [storyId])

  const displayPages: Array<{
    pageIndex: number
    sentences: Array<{ sentenceId: number | null; en: string; ko: string | null }>
  }> = scenes
    ? scenes.map((scene, idx) => ({
        pageIndex: idx,
        sentences: scene.sentences.map(s => ({
          sentenceId: s.id,
          en: s.englishText,
          ko: s.koreanText,
        })),
      }))
    : projectData.step4.pages.map((page, idx) => {
        const enSentences = splitSentences(page.en)
        const koSentences = page.ko ? splitSentences(page.ko) : []
        return {
          pageIndex: idx,
          sentences: enSentences.map((en, sIdx) => ({
            sentenceId: null,
            en,
            ko: koSentences[sIdx] ?? null,
          })),
        }
      })

  const [highlights, setHighlights] = useState<HighlightSentence[]>([])
  const [selectedPage, setSelectedPage] = useState<number | null>(null)

  const [outroText, setOutroText] = useState('')
  const [outroSignature, setOutroSignature] = useState('')
  const [outroAudioUrl, setOutroAudioUrl] = useState<string | null>(null)
  const [outroUploading, setOutroUploading] = useState(false)
  const [outroSaving, setOutroSaving] = useState(false)

  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget>(null)
  const [isRecording, setIsRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

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

  const uploadHighlightVoice = useCallback(
    async (pageIndex: number, sentenceIndex: number, sentenceId: number, blob: Blob) => {
      if (!storyId) return
      setHighlights(prev =>
        prev.map(h =>
          h.pageIndex === pageIndex && h.sentenceIndex === sentenceIndex
            ? { ...h, uploading: true }
            : h,
        ),
      )
      try {
        const { uploadUrl, s3Key } = await presignHighlightVoice(storyId, sentenceId, blob.type || 'audio/webm')
        await uploadAudioToS3(uploadUrl, blob)
        const result = await commitHighlightVoice(storyId, sentenceId, s3Key)
        setHighlights(prev =>
          prev.map(h =>
            h.pageIndex === pageIndex && h.sentenceIndex === sentenceIndex
              ? { ...h, audioUrl: result.audioUrl, uploading: false }
              : h,
          ),
        )
      } catch (err) {
        console.error('Highlight voice upload failed:', err)
        const localUrl = await blobToDataUrl(blob)
        setHighlights(prev =>
          prev.map(h =>
            h.pageIndex === pageIndex && h.sentenceIndex === sentenceIndex
              ? { ...h, audioUrl: localUrl, uploading: false }
              : h,
          ),
        )
      }
    },
    [storyId],
  )

  const uploadOutroVoiceToServer = useCallback(
    async (blob: Blob) => {
      if (!storyId) return
      setOutroUploading(true)
      try {
        const { uploadUrl, s3Key } = await presignOutroVoice(storyId, blob.type || 'audio/webm')
        await uploadAudioToS3(uploadUrl, blob)
        const result = await commitOutroVoice(storyId, s3Key)
        setOutroAudioUrl(result.audioUrl)
      } catch (err) {
        console.error('Outro voice upload failed:', err)
        const localUrl = await blobToDataUrl(blob)
        setOutroAudioUrl(localUrl)
      } finally {
        setOutroUploading(false)
      }
    },
    [storyId],
  )

  const startRecording = useCallback(
    async (target: RecordingTarget) => {
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
          if (target?.kind === 'highlight') {
            const highlight = highlights.find(
              h => h.pageIndex === target.pageIndex && h.sentenceIndex === target.sentenceIndex,
            )
            if (highlight?.sentenceId && storyId) {
              void uploadHighlightVoice(target.pageIndex, target.sentenceIndex, highlight.sentenceId, blob)
            } else {
              const url = await blobToDataUrl(blob)
              setHighlights(prev =>
                prev.map(h =>
                  h.pageIndex === target.pageIndex && h.sentenceIndex === target.sentenceIndex
                    ? { ...h, audioUrl: url }
                    : h,
                ),
              )
            }
          } else if (target?.kind === 'outro') {
            if (storyId) {
              void uploadOutroVoiceToServer(blob)
            } else {
              const url = await blobToDataUrl(blob)
              setOutroAudioUrl(url)
            }
          }
          setIsRecording(false)
          setRecordingTarget(null)
          cleanupStream()
        }

        setRecordingTarget(target)
        setIsRecording(true)
        rec.start()
      } catch {
        setIsRecording(false)
        setRecordingTarget(null)
        cleanupStream()
        alert('마이크 권한이 필요합니다.')
      }
    },
    [cleanupStream, highlights, storyId, uploadHighlightVoice, uploadOutroVoiceToServer],
  )

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  const toggleHighlight = useCallback(
    (pageIndex: number, sentenceIndex: number, sentenceId: number | null, text: string) => {
      setHighlights(prev => {
        const exists = prev.find(h => h.pageIndex === pageIndex && h.sentenceIndex === sentenceIndex)
        if (exists) {
          if (exists.sentenceId && storyId && exists.audioUrl) {
            deleteHighlightVoice(storyId, exists.sentenceId).catch(() => {})
          }
          return prev.filter(h => !(h.pageIndex === pageIndex && h.sentenceIndex === sentenceIndex))
        }
        return [
          ...prev,
          { pageIndex, sentenceIndex, sentenceId: sentenceId ?? 0, text, audioUrl: null, uploading: false },
        ]
      })
    },
    [storyId],
  )

  const handleSaveOutro = useCallback(async () => {
    if (!storyId || !outroText.trim()) return
    setOutroSaving(true)
    try {
      await saveOutro(storyId, outroText.trim(), outroSignature.trim() || null)
    } catch (err) {
      console.error('Outro save failed:', err)
    } finally {
      setOutroSaving(false)
    }
  }, [storyId, outroText, outroSignature])

  const handleNext = useCallback(async () => {
    if (!storyId) return
    setConfirmError(null)
    try {
      if (outroText.trim()) {
        await saveOutro(storyId, outroText.trim(), outroSignature.trim() || null)
      }
      const job = await confirmStoryboard(storyId)
      setStoryGenerationJobId(job.jobId)
      onNext()
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string }
      if (apiErr?.status === 409) {
        setConfirmError('선행 단계가 완료되지 않았어요. 이전 단계를 확인해 주세요.')
      } else {
        setConfirmError(apiErr?.message ?? '동화책 생성 요청 중 오류가 발생했어요.')
      }
    }
  }, [storyId, outroText, outroSignature, confirmStoryboard, setStoryGenerationJobId, onNext])

  const playAudio = useCallback((url: string) => {
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(url)
    audioRef.current = audio
    setPlayingUrl(url)
    audio.onended = () => setPlayingUrl(null)
    audio.play().catch(() => setPlayingUrl(null))
  }, [])

  const stopAudio = useCallback(() => {
    audioRef.current?.pause()
    setPlayingUrl(null)
  }, [])

  const isHighlightRecording = (pageIndex: number, sentenceIndex: number) =>
    isRecording &&
    recordingTarget?.kind === 'highlight' &&
    recordingTarget.pageIndex === pageIndex &&
    recordingTarget.sentenceIndex === sentenceIndex
  const isOutroRecording = isRecording && recordingTarget?.kind === 'outro'

  const recBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#fcefe7' : 'var(--cr-rust)',
    color: active ? 'var(--cr-rust)' : '#fdf6dc',
    border: `2px solid ${active ? 'var(--cr-rust)' : '#8a4a32'}`,
    borderRadius: 999,
    padding: '8px 18px',
    fontFamily: 'var(--cr-font-gaegu)',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: active ? 'none' : '0 2px 0 #8a4a32',
  })

  return (
    <div className="cr-shell">
      <CreationDoodlesBg />
      <CreationHeader currentStep={7} />

      <div className="cr-scroll">
        <main className="cr-shell-inner cr-fade-in">
          <StepTitleBlock
            stepNumber={7}
            title="특별한 문장을 직접 읽어주세요"
            subtitle="각 페이지에서 강조할 문장을 골라 부모님 목소리로 녹음하고, 마지막 아웃트로 멘트도 녹음해 주세요"
          />

          {loadingScenes && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--cr-sage-deep)' }} />
            </div>
          )}

          {/* Section 1: 강조 문장 선택 + 녹음 */}
          <section className="cr-card">
            <span className="cr-tape" aria-hidden="true" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--cr-sage-darker)',
                  color: '#fdf6dc',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Star className="w-4 h-4" />
              </span>
              <div>
                <div className="cr-step-label" style={{ marginBottom: 2 }}>
                  강조 문장
                </div>
                <h3 style={{ fontFamily: 'var(--cr-font-serif)', fontWeight: 800, fontSize: 22, color: 'var(--cr-ink)', margin: 0, letterSpacing: '-0.5px' }}>
                  페이지별 강조 문장 선택 & 녹음
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {displayPages.map(({ pageIndex, sentences }) => {
                const pageHighlights = highlights.filter(h => h.pageIndex === pageIndex)
                const isExpanded = selectedPage === pageIndex
                const hasSelection = pageHighlights.length > 0

                return (
                  <div
                    key={pageIndex}
                    style={{
                      borderRadius: 16,
                      border: `2px ${hasSelection ? 'solid' : 'dashed'} ${
                        hasSelection ? 'var(--cr-sage-deep)' : 'var(--cr-caramel)'
                      }`,
                      background: hasSelection ? '#eaf4dc' : '#fdf6dc',
                      padding: '16px 18px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPage(isExpanded ? null : pageIndex)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        background: 'transparent',
                        border: 0,
                        cursor: 'pointer',
                        padding: 0,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'var(--cr-sage-darker)',
                            color: '#fdf6dc',
                            display: 'grid',
                            placeItems: 'center',
                            fontFamily: 'var(--cr-font-serif)',
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          {pageIndex + 1}
                        </span>
                        <span style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 14, fontWeight: 700, color: 'var(--cr-ink-soft)' }}>
                          Page {pageIndex + 1}
                        </span>
                        {hasSelection && (
                          <span style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 13, fontWeight: 700, color: 'var(--cr-sage-deep)' }}>
                            ({pageHighlights.length}개 선택)
                          </span>
                        )}
                      </div>
                      <span style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 13, color: 'var(--cr-ink-soft)' }}>
                        {isExpanded ? '접기 ▲' : '펼치기 ▼'}
                      </span>
                    </button>

                    {!isExpanded && (
                      <p
                        style={{
                          fontFamily: 'var(--cr-font-gaegu)',
                          fontSize: 15,
                          color: 'var(--cr-ink)',
                          margin: 0,
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {sentences.map(s => s.en).join(' ')}
                      </p>
                    )}

                    {isExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                        {sentences.map((sentence, sIdx) => {
                          const highlight = highlights.find(
                            h => h.pageIndex === pageIndex && h.sentenceIndex === sIdx,
                          )
                          const isSelected = !!highlight
                          const recording = isHighlightRecording(pageIndex, sIdx)

                          return (
                            <div
                              key={sIdx}
                              style={{
                                borderRadius: 14,
                                border: `2px solid ${isSelected ? 'var(--cr-sage-deep)' : 'var(--cr-caramel)'}`,
                                background: isSelected ? '#dceec8' : 'var(--cr-paper)',
                                padding: '12px 14px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                                <span
                                  style={{
                                    fontFamily: 'var(--cr-font-gaegu)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: 'var(--cr-ink-soft)',
                                    flexShrink: 0,
                                  }}
                                >
                                  {sIdx + 1}/{sentences.length}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleHighlight(pageIndex, sIdx, sentence.sentenceId, sentence.en)}
                                  disabled={isRecording}
                                  style={{
                                    padding: '4px 12px',
                                    borderRadius: 999,
                                    fontFamily: 'var(--cr-font-gaegu)',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    background: isSelected ? 'var(--cr-rust)' : 'var(--cr-sage-darker)',
                                    color: '#fdf6dc',
                                    border: `1.5px solid ${isSelected ? '#8a4a32' : '#2a3f1f'}`,
                                    cursor: isRecording ? 'not-allowed' : 'pointer',
                                    opacity: isRecording ? 0.5 : 1,
                                  }}
                                >
                                  {isSelected ? '해제' : '선택'}
                                </button>
                              </div>

                              <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 16, fontWeight: 600, color: 'var(--cr-ink)', margin: 0, lineHeight: 1.5 }}>
                                {sentence.en}
                              </p>
                              {sentence.ko && (
                                <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 13, color: 'var(--cr-ink-soft)', margin: '4px 0 0', fontStyle: 'italic' }}>
                                  {sentence.ko}
                                </p>
                              )}

                              {isSelected && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                  {highlight.uploading ? (
                                    <span style={{ ...recBtnStyle(true), background: '#fbf2da', color: 'var(--cr-ink-soft)', borderColor: 'var(--cr-caramel)', boxShadow: 'none' }}>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> 업로드 중...
                                    </span>
                                  ) : !recording ? (
                                    <button
                                      type="button"
                                      onClick={() => void startRecording({ kind: 'highlight', pageIndex, sentenceIndex: sIdx })}
                                      disabled={isRecording}
                                      style={{
                                        ...recBtnStyle(false),
                                        opacity: isRecording ? 0.4 : 1,
                                        cursor: isRecording ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      <Mic className="w-3.5 h-3.5" />
                                      {highlight.audioUrl ? '다시 녹음' : '녹음하기'}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={stopRecording}
                                      style={recBtnStyle(true)}
                                    >
                                      <Square className="w-3.5 h-3.5" /> 녹음 중지
                                    </button>
                                  )}

                                  {highlight.audioUrl && !recording && !highlight.uploading && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          playingUrl === highlight.audioUrl
                                            ? stopAudio()
                                            : playAudio(highlight.audioUrl!)
                                        }
                                        style={{
                                          background: 'var(--cr-sage)',
                                          color: '#fdf6dc',
                                          border: '2px solid var(--cr-sage-deep)',
                                          borderRadius: 999,
                                          padding: '6px 14px',
                                          fontFamily: 'var(--cr-font-gaegu)',
                                          fontWeight: 700,
                                          fontSize: 13,
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 6,
                                          boxShadow: '0 2px 0 var(--cr-sage-deep)',
                                        }}
                                      >
                                        {playingUrl === highlight.audioUrl ? (
                                          <><Pause className="w-3.5 h-3.5" /> 정지</>
                                        ) : (
                                          <><Play className="w-3.5 h-3.5" /> 듣기</>
                                        )}
                                      </button>
                                      <span style={{ fontFamily: 'var(--cr-font-gaegu)', fontWeight: 700, fontSize: 12, color: 'var(--cr-sage-deep)', alignSelf: 'center' }}>
                                        녹음 완료
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {highlights.length > 0 && (
              <p style={{ marginTop: 14, textAlign: 'center', fontFamily: 'var(--cr-font-gaegu)', fontSize: 14, color: 'var(--cr-sage-deep)', fontWeight: 700 }}>
                {highlights.length}개 문장 선택됨 · {highlights.filter(h => h.audioUrl).length}개 녹음 완료
              </p>
            )}
          </section>

          {/* Section 2: 아웃트로 */}
          <section className="cr-card">
            <span className="cr-tape" aria-hidden="true" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--cr-rust)',
                  color: '#fdf6dc',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <MessageSquareHeart className="w-4 h-4" />
              </span>
              <div>
                <div className="cr-step-label" style={{ marginBottom: 2 }}>
                  아웃트로
                </div>
                <h3 style={{ fontFamily: 'var(--cr-font-serif)', fontWeight: 800, fontSize: 22, color: 'var(--cr-ink)', margin: 0, letterSpacing: '-0.5px' }}>
                  마무리 인사를 남겨주세요
                </h3>
              </div>
            </div>

            <div className="cr-field">
              <label className="cr-label" style={{ fontSize: 16 }}>마무리 멘트</label>
              <textarea
                value={outroText}
                onChange={e => setOutroText(e.target.value)}
                onBlur={handleSaveOutro}
                rows={4}
                placeholder="예: 해솔아, 오늘도 씩씩했어. 잘 자, 내 작은 용감이. 사랑해!"
                className="cr-textarea"
              />
            </div>

            <div className="cr-field">
              <label className="cr-label" style={{ fontSize: 16 }}>서명 (선택)</label>
              <input
                type="text"
                value={outroSignature}
                onChange={e => setOutroSignature(e.target.value)}
                onBlur={handleSaveOutro}
                placeholder="예: — 사랑하는 엄마가"
                className="cr-input"
              />
            </div>

            {outroSaving && (
              <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 13, color: 'var(--cr-ink-soft)', display: 'inline-flex', alignItems: 'center', gap: 4, margin: 0 }}>
                <Loader2 className="w-3 h-3 animate-spin" /> 저장 중...
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
              {outroUploading ? (
                <span style={recBtnStyle(true)}>
                  <Loader2 className="w-4 h-4 animate-spin" /> 업로드 중...
                </span>
              ) : !isOutroRecording ? (
                <button
                  type="button"
                  onClick={() => void startRecording({ kind: 'outro' })}
                  disabled={isRecording || !outroText.trim()}
                  style={{
                    ...recBtnStyle(false),
                    opacity: isRecording || !outroText.trim() ? 0.4 : 1,
                    cursor: isRecording || !outroText.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Mic className="w-4 h-4" />
                  {outroAudioUrl ? '아웃트로 다시 녹음' : '아웃트로 녹음하기'}
                </button>
              ) : (
                <button type="button" onClick={stopRecording} style={recBtnStyle(true)}>
                  <Square className="w-4 h-4" /> 녹음 중지
                </button>
              )}

              {outroAudioUrl && !isOutroRecording && !outroUploading && (
                <>
                  <button
                    type="button"
                    onClick={() => (playingUrl === outroAudioUrl ? stopAudio() : playAudio(outroAudioUrl))}
                    style={{
                      background: 'var(--cr-sage)',
                      color: '#fdf6dc',
                      border: '2px solid var(--cr-sage-deep)',
                      borderRadius: 999,
                      padding: '8px 18px',
                      fontFamily: 'var(--cr-font-gaegu)',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 0 var(--cr-sage-deep)',
                    }}
                  >
                    {playingUrl === outroAudioUrl ? (
                      <><Pause className="w-4 h-4" /> 정지</>
                    ) : (
                      <><Play className="w-4 h-4" /> 듣기</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutroAudioUrl(null)}
                    className="cr-btn-back"
                    style={{ justifySelf: 'auto' }}
                  >
                    <RotateCcw className="w-4 h-4" /> 삭제
                  </button>
                  <span style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 13, fontWeight: 700, color: 'var(--cr-sage-deep)', alignSelf: 'center' }}>
                    녹음 완료
                  </span>
                </>
              )}
            </div>

            {outroText.trim() && (
              <div
                style={{
                  marginTop: 16,
                  padding: '14px 18px',
                  background: '#fbf2da',
                  border: '2px dashed var(--cr-caramel)',
                  borderRadius: 14,
                }}
              >
                <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 13, color: 'var(--cr-caramel-deep)', fontWeight: 700, margin: '0 0 6px' }}>
                  미리보기
                </p>
                <p style={{ fontFamily: 'var(--cr-font-serif)', fontSize: 17, color: 'var(--cr-ink)', whiteSpace: 'pre-line', lineHeight: 1.6, margin: 0 }}>
                  {outroText}
                </p>
                {outroSignature && (
                  <p style={{ fontFamily: 'var(--cr-font-gaegu)', fontSize: 15, color: 'var(--cr-ink-soft)', fontStyle: 'italic', margin: '8px 0 0' }}>
                    {outroSignature}
                  </p>
                )}
              </div>
            )}
          </section>

          {confirmError && (
            <div className="cr-banner error" role="alert" style={{ marginTop: 16 }}>
              {confirmError}
            </div>
          )}
        </main>
      </div>

      <CreationFooter
        currentStep={7}
        onBack={onBack}
        onNext={() => void handleNext()}
        nextLabel={isConfirming ? '동화책 만드는 중...' : '완성 미리보기'}
        nextDisabled={isConfirming}
      />
    </div>
  )
}
