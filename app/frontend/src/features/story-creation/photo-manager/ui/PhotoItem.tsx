import { useEffect, useState } from 'react'
import { Trash2, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react'

/**
 * tagsJson (DB 의 JSON 컬럼) ↔ UI 의 plain 텍스트 변환.
 * BE 는 `JSON.stringify("#제주 #여행")` 같은 JSON string 을 저장하고, FE 는 파싱해서 입력창에 표시.
 */
function parseTagsJson(json: string | null | undefined): string {
  if (!json) return ''
  try {
    const parsed = JSON.parse(json)
    return typeof parsed === 'string' ? parsed : ''
  } catch {
    return ''
  }
}

interface PhotoItemCommittedProps {
  mode: 'committed'
  imageUrl: string
  description: string | null
  tagsJson: string | null
  onRemove: () => void
  onUpdate: (patch: { description?: string; tagsJson?: string }) => void
  isRemoving?: boolean
}

interface PhotoItemUploadingProps {
  mode: 'uploading'
  previewUrl: string
  fileName: string
}

interface PhotoItemErrorProps {
  mode: 'error'
  previewUrl: string
  fileName: string
  error: string
  onDismiss: () => void
}

type PhotoItemProps = PhotoItemCommittedProps | PhotoItemUploadingProps | PhotoItemErrorProps

export function PhotoItem(props: PhotoItemProps) {
  return (
    <div
      className={`bg-[#f0e6c0] p-4 md:p-6 rounded-2xl shadow-sm border-2 transition-colors flex flex-col md:flex-row gap-6 relative group ${
        props.mode === 'error' ? 'border-[#8b3a2a]' : 'border-[#8b7a52]/60 hover:border-[#2d5a27]'
      }`}
    >
      {/* 우상단 액션 버튼 */}
      {props.mode === 'committed' && (
        <button
          type="button"
          onClick={props.onRemove}
          disabled={props.isRemoving}
          title="사진 삭제"
          aria-label="사진 삭제"
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center bg-[#8b3a2a] text-[#f0e6c0] border-2 border-[#c97b4a] opacity-0 group-hover:opacity-100 hover:bg-[#a84a35] transition-all z-10 disabled:opacity-50"
        >
          {props.isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      )}
      {props.mode === 'error' && (
        <button
          type="button"
          onClick={props.onDismiss}
          title="에러 무시"
          aria-label="에러 무시"
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center bg-[#8b3a2a] text-[#f0e6c0] border-2 border-[#c97b4a] hover:bg-[#a84a35] z-10"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* 썸네일 */}
      <Thumbnail props={props} />

      {/* 우측 상세 영역 */}
      <div className="flex-1 min-w-0">
        {props.mode === 'committed' ? (
          <CommittedFields
            description={props.description}
            tagsJson={props.tagsJson}
            onUpdate={props.onUpdate}
          />
        ) : (
          <StatusText {...props} />
        )}
      </div>
    </div>
  )
}

/** 썸네일 영역 + uploading 오버레이. */
function Thumbnail({ props }: { props: PhotoItemProps }) {
  const previewSrc = props.mode === 'committed' ? props.imageUrl : props.previewUrl
  return (
    <div className="w-full md:w-48 aspect-video md:aspect-square rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-[#b4dc8c]/40 to-[#e8ddb4] flex items-center justify-center border border-[#8b7a52]/30 relative">
      {previewSrc ? (
        <img src={previewSrc} alt="사진" className="w-full h-full object-cover" draggable={false} />
      ) : (
        <ImageIcon className="w-12 h-12 text-[#8b7a52] opacity-50" />
      )}
      {props.mode === 'uploading' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-[#f0e6c0] animate-spin" />
        </div>
      )}
    </div>
  )
}

/** committed 사진의 설명/태그 입력 + 로컬 상태 + onBlur 시 PATCH. */
function CommittedFields({
  description,
  tagsJson,
  onUpdate,
}: {
  description: string | null
  tagsJson: string | null
  onUpdate: (patch: { description?: string; tagsJson?: string }) => void
}) {
  const [descLocal, setDescLocal] = useState(description ?? '')
  const [tagsLocal, setTagsLocal] = useState(parseTagsJson(tagsJson))

  // 서버값이 변경되면 (다른 세션/탭에서 수정 등) 로컬 state 재동기화.
  useEffect(() => {
    setDescLocal(description ?? '')
  }, [description])
  useEffect(() => {
    setTagsLocal(parseTagsJson(tagsJson))
  }, [tagsJson])

  function handleDescBlur() {
    const serverValue = description ?? ''
    if (descLocal !== serverValue) {
      onUpdate({ description: descLocal })
    }
  }

  function handleTagsBlur() {
    const serverValue = parseTagsJson(tagsJson)
    if (tagsLocal !== serverValue) {
      onUpdate({ tagsJson: JSON.stringify(tagsLocal) })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-black text-sm mb-1 font-bold">사진 설명 (선택)</label>
        <input
          type="text"
          placeholder="예: 해솔이가 처음으로 바다에 발을 담근 날"
          value={descLocal}
          onChange={e => setDescLocal(e.target.value)}
          onBlur={handleDescBlur}
          className="w-full p-3 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-black placeholder-black/60"
        />
      </div>
      <div>
        <label className="block text-black text-sm mb-1 font-bold">태그 (선택)</label>
        <input
          type="text"
          placeholder="예: #제주도 #여름휴가 #해솔이첫바다"
          value={tagsLocal}
          onChange={e => setTagsLocal(e.target.value)}
          onBlur={handleTagsBlur}
          className="w-full p-3 bg-[#e8ddb4] border-2 border-[#8b7a52]/60 rounded-xl focus:border-[#2d5a27] focus:outline-none text-black placeholder-black/60 font-bold"
        />
      </div>
    </div>
  )
}

/** uploading / error 상태용 간단 텍스트. */
function StatusText(props: PhotoItemUploadingProps | PhotoItemErrorProps) {
  if (props.mode === 'uploading') {
    return (
      <div className="flex flex-col justify-center h-full">
        <div className="text-sm text-[#2d5a27] font-bold flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 업로드 중…
        </div>
        <div className="text-xs text-black/60 mt-1 truncate">{props.fileName}</div>
      </div>
    )
  }
  return (
    <div className="flex flex-col justify-center h-full">
      <div className="text-sm text-[#8b3a2a] font-bold flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> 업로드 실패
      </div>
      <div className="text-xs text-black/60 mt-1 truncate">{props.fileName}</div>
      <div className="text-xs text-[#8b3a2a] mt-1 line-clamp-2">{props.error}</div>
    </div>
  )
}
