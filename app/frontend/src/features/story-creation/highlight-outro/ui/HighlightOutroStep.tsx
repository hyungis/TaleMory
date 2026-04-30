import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
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

interface HighlightOutroStepProps {
  storyId?: number | null
  projectData: StoryProject
  onBack: () => void
  onNext: () => void
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

/** 마침표·느낌표·물음표 기준으로 문장을 분리한다. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * STEP 07 — "강조 녹음 & 아웃트로"
 *
 * 2 섹션:
 *  1. 강조 문장 선택 + 부모 직접 녹음
 *     - 스토리보드 페이지별 문장 중 하나를 선택
 *     - 선택된 문장을 부모가 직접 읽어 녹음
 *  2. 아웃트로 멘트 작성 + 녹음
 *     - 마무리 인사 텍스트 입력
 *     - 서명 입력
 *     - 부모가 직접 읽어 녹음
 */
export function HighlightOutroStep({
  storyId,
  projectData,
  onBack,
  onNext,
}: HighlightOutroStepProps) {
  // --- 씬 데이터 (백엔드 연동 시 사용) ---
  const [scenes, setScenes] = useState<SceneDto[] | null>(null)
  const [loadingScenes, setLoadingScenes] = useState(false)

  // 백엔드에서 씬을 가져오거나, 없으면 step4.pages fallback
  useEffect(() => {
    if (!storyId) return
    setLoadingScenes(true)
    getScenes(storyId)
      .then(data => {
        if (data.length > 0) setScenes(data)
      })
      .catch(() => { /* fallback to step4.pages */ })
      .finally(() => setLoadingScenes(false))
  }, [storyId])

  // 씬 기반 또는 step4.pages fallback 으로 표시할 페이지 데이터
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

  // --- 강조 문장 ---
  const [highlights, setHighlights] = useState<HighlightSentence[]>([])
  const [selectedPage, setSelectedPage] = useState<number | null>(null)

  // --- 아웃트로 ---
  const [outroText, setOutroText] = useState('')
  const [outroSignature, setOutroSignature] = useState('')
  const [outroAudioUrl, setOutroAudioUrl] = useState<string | null>(null)
  const [outroUploading, setOutroUploading] = useState(false)
  const [outroSaving, setOutroSaving] = useState(false)

  // --- 녹음 공용 ---
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget>(null)
  const [isRecording, setIsRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // --- 재생 ---
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

  /** 3-phase 업로드: presign → S3 PUT → DB commit */
  const uploadHighlightVoice = useCallback(async (
    pageIndex: number,
    sentenceIndex: number,
    sentenceId: number,
    blob: Blob,
  ) => {
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
      // fallback: 로컬 data URL 사용
      const localUrl = await blobToDataUrl(blob)
      setHighlights(prev =>
        prev.map(h =>
          h.pageIndex === pageIndex && h.sentenceIndex === sentenceIndex
            ? { ...h, audioUrl: localUrl, uploading: false }
            : h,
        ),
      )
    }
  }, [storyId])

  const uploadOutroVoiceToServer = useCallback(async (blob: Blob) => {
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
  }, [storyId])

  const startRecording = useCallback(async (target: RecordingTarget) => {
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
            // 백엔드 연동: 3-phase upload
            void uploadHighlightVoice(target.pageIndex, target.sentenceIndex, highlight.sentenceId, blob)
          } else {
            // fallback: local data URL
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
  }, [cleanupStream, highlights, storyId, uploadHighlightVoice, uploadOutroVoiceToServer])

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  const toggleHighlight = useCallback((pageIndex: number, sentenceIndex: number, sentenceId: number | null, text: string) => {
    setHighlights(prev => {
      const exists = prev.find(h => h.pageIndex === pageIndex && h.sentenceIndex === sentenceIndex)
      if (exists) {
        // 선택 해제 시 서버에서도 삭제
        if (exists.sentenceId && storyId && exists.audioUrl) {
          deleteHighlightVoice(storyId, exists.sentenceId).catch(() => {})
        }
        return prev.filter(h => !(h.pageIndex === pageIndex && h.sentenceIndex === sentenceIndex))
      }
      return [...prev, { pageIndex, sentenceIndex, sentenceId: sentenceId ?? 0, text, audioUrl: null, uploading: false }]
    })
  }, [storyId])

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

  const playAudio = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
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
    isRecording && recordingTarget?.kind === 'highlight' && recordingTarget.pageIndex === pageIndex && recordingTarget.sentenceIndex === sentenceIndex
  const isOutroRecording = isRecording && recordingTarget?.kind === 'outro'

  return (
    <div className="bookshelf-modal step-forest-modal">
      <CreationHeader currentStep={7} />

      <div className="bookshelf-scroll">
        <main className="py-10 px-6 md:px-12 lg:px-24 xl:px-32 2xl:px-40 bookshelf-fade-in">
          <div className="max-w-4xl mx-auto pb-12">
            {/* 타이틀 */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#2d5a27] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[#b4dc8c] shadow-[0_0_20px_rgba(180,220,140,0.4)]">
                <Star className="w-8 h-8 text-[#f0e6c0]" />
              </div>
              <h2 className="text-3xl text-[#f0e6c0] font-bold">
                특별한 문장을 직접 읽어주세요
              </h2>
              <p className="text-[#b4c4a4] mt-2">
                각 페이지에서 강조할 문장을 골라 부모님 목소리로 녹음하고, 마지막 아웃트로 멘트도 녹음해 주세요.
              </p>
            </div>

            {loadingScenes && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-[#b4dc8c] animate-spin" />
              </div>
            )}

            <div className="flex flex-col gap-6">
              {/* Section 1: 강조 문장 선택 + 녹음 */}
              <section className="bg-[#f0e6c0] p-6 md:p-8 rounded-[2rem] border-2 border-[#2a1b12] shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#2d5a27] flex items-center justify-center text-[#b4dc8c] border border-[#b4dc8c]/40">
                    <Star className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[#8b7a52] text-sm">강조 문장</p>
                    <h3 className="text-2xl text-[#2d5a27] font-bold">
                      페이지별 강조 문장 선택 & 녹음
                    </h3>
                  </div>
                </div>

                <div className="space-y-4">
                  {displayPages.map(({ pageIndex, sentences }) => {
                    const pageHighlights = highlights.filter(h => h.pageIndex === pageIndex)
                    const isExpanded = selectedPage === pageIndex

                    return (
                      <div
                        key={pageIndex}
                        className={`rounded-[1.5rem] border-2 p-5 transition-colors ${
                          pageHighlights.length > 0
                            ? 'border-[#2d5a27] bg-[#d4eac8]'
                            : 'border-[#8b7a52]/40 bg-[#e8ddb4]'
                        }`}
                      >
                        {/* 페이지 헤더 */}
                        <button
                          type="button"
                          onClick={() => setSelectedPage(isExpanded ? null : pageIndex)}
                          className="flex items-center justify-between w-full mb-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#2d5a27] text-[#f0e6c0] text-sm font-bold">
                              {pageIndex + 1}
                            </span>
                            <span className="text-[#8b7a52] text-sm font-bold">
                              Page {pageIndex + 1}
                            </span>
                            {pageHighlights.length > 0 && (
                              <span className="text-[#2d5a27] text-xs font-bold ml-1">
                                ({pageHighlights.length}개 선택)
                              </span>
                            )}
                          </div>
                          <span className="text-[#8b7a52] text-sm">
                            {isExpanded ? '접기 ▲' : '펼치기 ▼'}
                          </span>
                        </button>

                        {/* 영어(녹음 대상) 미리보기 — 접힌 상태에서도 표시 */}
                        {!isExpanded && (
                          <p className="text-[#2d5a27] text-base leading-relaxed line-clamp-2">
                            {sentences.map(s => s.en).join(' ')}
                          </p>
                        )}

                        {/* 문장별 선택 UI — 펼친 상태 */}
                        {isExpanded && (
                          <div className="space-y-3 mt-2">
                            {sentences.map((sentence, sIdx) => {
                              const highlight = highlights.find(
                                h => h.pageIndex === pageIndex && h.sentenceIndex === sIdx,
                              )
                              const isSelected = !!highlight
                              const recording = isHighlightRecording(pageIndex, sIdx)

                              return (
                                <div
                                  key={sIdx}
                                  className={`rounded-xl border-2 p-4 transition-colors ${
                                    isSelected
                                      ? 'border-[#2d5a27] bg-[#c8e6b8]'
                                      : 'border-[#8b7a52]/30 bg-[#f0e6c0]'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <span className="text-[#8b7a52] text-xs font-bold shrink-0 mt-1">
                                      {sIdx + 1}/{sentences.length}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleHighlight(pageIndex, sIdx, sentence.sentenceId, sentence.en)}
                                      disabled={isRecording}
                                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors shrink-0 ${
                                        isSelected
                                          ? 'bg-[#8b3a2a] text-[#f0e6c0] hover:bg-[#a84a35]'
                                          : 'bg-[#2d5a27] text-[#f0e6c0] hover:bg-[#3d6f34]'
                                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                                    >
                                      {isSelected ? '해제' : '선택'}
                                    </button>
                                  </div>

                                  {/* 영어 — 크게 (녹음 대상) */}
                                  <p className="text-[#2d5a27] text-lg leading-relaxed font-medium">
                                    {sentence.en}
                                  </p>
                                  {/* 한국어 — 작게 (참고용) */}
                                  {sentence.ko && (
                                    <p className="text-[#8b7a52] text-sm mt-1 italic">
                                      {sentence.ko}
                                    </p>
                                  )}

                                  {/* 녹음 컨트롤 */}
                                  {isSelected && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      {highlight.uploading ? (
                                        <span className="px-4 py-2 rounded-full bg-[#8b7a52]/30 text-[#2d5a27] flex items-center gap-2 text-sm font-bold">
                                          <Loader2 className="w-4 h-4 animate-spin" /> 업로드 중...
                                        </span>
                                      ) : !recording ? (
                                        <button
                                          type="button"
                                          onClick={() => void startRecording({ kind: 'highlight', pageIndex, sentenceIndex: sIdx })}
                                          disabled={isRecording}
                                          className="px-4 py-2 rounded-full bg-[#8b3a2a] text-[#f0e6c0] hover:bg-[#a84a35] transition-colors flex items-center gap-2 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          <Mic className="w-4 h-4" />
                                          {highlight.audioUrl ? '다시 녹음' : '녹음하기'}
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={stopRecording}
                                          className="px-4 py-2 rounded-full bg-[#c97b4a] text-[#f0e6c0] hover:bg-[#d88a58] transition-colors flex items-center gap-2 text-sm font-bold animate-pulse"
                                        >
                                          <Square className="w-4 h-4" /> 녹음 중지
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
                                            className="px-4 py-2 rounded-full bg-[#2d5a27] text-[#f0e6c0] hover:bg-[#3d6f34] transition-colors flex items-center gap-2 text-sm font-bold"
                                          >
                                            {playingUrl === highlight.audioUrl ? (
                                              <><Pause className="w-4 h-4" /> 정지</>
                                            ) : (
                                              <><Play className="w-4 h-4" /> 듣기</>
                                            )}
                                          </button>
                                          <span className="text-[#2d5a27] text-xs font-bold">녹음 완료</span>
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
                  <p className="mt-4 text-[#2d5a27] text-sm font-bold text-center">
                    {highlights.length}개 문장 선택됨 · {highlights.filter(h => h.audioUrl).length}개 녹음 완료
                  </p>
                )}
              </section>

              {/* Section 2: 아웃트로 멘트 */}
              <section className="bg-[#f0e6c0] p-6 md:p-8 rounded-[2rem] border-2 border-[#2a1b12] shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#c97b4a] flex items-center justify-center text-[#f0e6c0]">
                    <MessageSquareHeart className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[#8b7a52] text-sm">아웃트로</p>
                    <h3 className="text-2xl text-[#2d5a27] font-bold">
                      마무리 인사를 남겨주세요
                    </h3>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border-2 border-[#8b7a52]/40 bg-[#e8ddb4] p-6 space-y-4">
                  <div>
                    <label className="block text-[#8b7a52] text-sm mb-2 font-bold">
                      마무리 멘트
                    </label>
                    <textarea
                      value={outroText}
                      onChange={e => setOutroText(e.target.value)}
                      onBlur={handleSaveOutro}
                      rows={4}
                      placeholder="예: 해솔아, 오늘도 씩씩했어. 잘 자, 내 작은 용감이. 사랑해!"
                      className="w-full p-4 rounded-2xl border-2 border-[#8b7a52]/60 bg-[#f0e6c0] text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/40 resize-none placeholder-[#8b7a52]/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[#8b7a52] text-sm mb-2 font-bold">
                      서명 (선택)
                    </label>
                    <input
                      type="text"
                      value={outroSignature}
                      onChange={e => setOutroSignature(e.target.value)}
                      onBlur={handleSaveOutro}
                      placeholder="예: — 사랑하는 엄마가"
                      className="w-full p-3 rounded-2xl border-2 border-[#8b7a52]/60 bg-[#f0e6c0] text-[#2d5a27] focus:outline-none focus:border-[#2d5a27] focus:ring-4 focus:ring-[#b4dc8c]/40 placeholder-[#8b7a52]/60"
                    />
                  </div>

                  {outroSaving && (
                    <p className="text-[#8b7a52] text-xs flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> 저장 중...
                    </p>
                  )}

                  {/* 아웃트로 녹음 */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {outroUploading ? (
                      <span className="px-6 py-3 rounded-full bg-[#8b7a52]/30 text-[#2d5a27] flex items-center gap-2 font-bold">
                        <Loader2 className="w-4 h-4 animate-spin" /> 업로드 중...
                      </span>
                    ) : !isOutroRecording ? (
                      <button
                        type="button"
                        onClick={() => void startRecording({ kind: 'outro' })}
                        disabled={isRecording || !outroText.trim()}
                        className="px-6 py-3 rounded-full bg-[#8b3a2a] text-[#f0e6c0] hover:bg-[#a84a35] transition-colors flex items-center gap-2 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Mic className="w-4 h-4" />
                        {outroAudioUrl ? '아웃트로 다시 녹음' : '아웃트로 녹음하기'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-6 py-3 rounded-full bg-[#c97b4a] text-[#f0e6c0] hover:bg-[#d88a58] transition-colors flex items-center gap-2 font-bold animate-pulse"
                      >
                        <Square className="w-4 h-4" /> 녹음 중지
                      </button>
                    )}

                    {outroAudioUrl && !isOutroRecording && !outroUploading && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            playingUrl === outroAudioUrl
                              ? stopAudio()
                              : playAudio(outroAudioUrl)
                          }
                          className="px-5 py-3 rounded-full bg-[#2d5a27] text-[#f0e6c0] hover:bg-[#3d6f34] transition-colors flex items-center gap-2 font-bold"
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
                          className="px-4 py-3 rounded-full bg-[#e8ddb4] border-2 border-[#8b7a52]/40 text-[#2d5a27] hover:bg-[#f0e6c0] transition-colors flex items-center gap-2 font-bold"
                        >
                          <RotateCcw className="w-4 h-4" /> 삭제
                        </button>
                        <span className="text-[#2d5a27] text-sm font-bold">녹음 완료</span>
                      </>
                    )}
                  </div>

                  {/* 미리보기 */}
                  {outroText.trim() && (
                    <div className="mt-4 rounded-[1.25rem] bg-[#f0e6c0] border-2 border-[#8b7a52]/40 p-5">
                      <p className="text-[#8b7a52] text-sm mb-2 font-bold">미리보기</p>
                      <p className="text-[#2d5a27] text-lg whitespace-pre-line leading-relaxed">
                        {outroText}
                      </p>
                      {outroSignature && (
                        <p className="text-[#8b7a52] text-base mt-3 italic">{outroSignature}</p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>

          </div>
        </main>
      </div>

      <CreationFooter
        currentStep={7}
        onBack={onBack}
        onNext={onNext}
        nextLabel="완성 미리보기"
      />
    </div>
  )
}
