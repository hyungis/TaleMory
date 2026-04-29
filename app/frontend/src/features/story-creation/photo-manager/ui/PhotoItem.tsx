import { useEffect, useState, type CSSProperties } from 'react'
import { Trash2, Image as ImageIcon, Loader2, AlertCircle, ChevronUp, ChevronDown, GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  /**
   * 드래그-정렬용 안정 식별자 (photoId). DndContext 의 SortableContext items 와 1:1 매칭.
   * uploading/error 모드는 reorder 대상이 아니라 id 가 없다.
   */
  id: number
  imageUrl: string
  description: string | null
  tagsJson: string | null
  onRemove: () => void
  onUpdate: (patch: { description?: string; tagsJson?: string }) => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  isRemoving?: boolean
  isReordering?: boolean
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

/**
 * PhotoItem 의 외부 진입점 — mode 별 분기.
 * committed 모드만 dnd-kit 의 useSortable 훅을 쓰는 별도 컴포넌트로 위임.
 * (훅은 조건부 호출 불가이므로 분기 자체는 분리된 컴포넌트로 처리.)
 */
export function PhotoItem(props: PhotoItemProps) {
  if (props.mode === 'committed') {
    return <SortablePhotoItem {...props} />
  }
  return <StaticPhotoItem {...props} />
}

/**
 * committed (서버 커밋된) 사진 카드. 드래그-정렬 활성화.
 *
 * 동작:
 *  - 카드 전체가 drag handle (별도 grip 아이콘 X — 카드 어디든 잡고 끌면 됨).
 *  - DndContext 의 PointerSensor activationConstraint(distance:8) 으로 짧은 클릭은 통과.
 *    → input/button 클릭이 drag 로 가로채지지 않음.
 *  - isDragging 상태일 때 그림자/투명도로 시각 피드백.
 *  - isReordering(서버 mutation 진행 중) 때는 추가 변경 막기 위해 disabled.
 */
function SortablePhotoItem(props: PhotoItemCommittedProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
    disabled: props.isReordering,
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
    cursor: props.isReordering ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-[#f0e6c0] p-4 md:p-6 rounded-2xl border-2 border-[#8b7a52]/60 hover:border-[#2d5a27] flex flex-col md:flex-row gap-6 relative group ${
        isDragging
          ? 'shadow-[0_12px_32px_rgba(0,0,0,0.45)] ring-2 ring-[#b4dc8c]/70'
          : 'shadow-sm transition-colors'
      }`}
    >
      {/* 좌측 grip 인디케이터 — 드래그 가능 affordance. 항상 약하게 보이고 hover 시 진해짐. */}
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 text-[#8b7a52]/40 group-hover:text-[#2d5a27] transition-colors pointer-events-none"
        aria-hidden="true"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* 우상단 액션 버튼 세트. dnd-kit listener 가 root 에 붙어있어 button 클릭도 drag 로 갈 수 있는데
          PointerSensor distance:8 제약으로 짧은 클릭은 통과 → 정상 동작. 추가로 onPointerDown stopPropagation
          은 의도적으로 안 함 (텍스트 선택 등 다른 native 동작도 막혀버림). */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          type="button"
          onClick={props.onMoveUp}
          disabled={props.isFirst || props.isReordering}
          title="위로 이동"
          aria-label="위로 이동"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-[#2d5a27] text-[#f0e6c0] border-2 border-[#b4dc8c] hover:bg-[#3d6f34] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={props.onMoveDown}
          disabled={props.isLast || props.isReordering}
          title="아래로 이동"
          aria-label="아래로 이동"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-[#2d5a27] text-[#f0e6c0] border-2 border-[#b4dc8c] hover:bg-[#3d6f34] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={props.onRemove}
          disabled={props.isRemoving}
          title="사진 삭제"
          aria-label="사진 삭제"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-[#8b3a2a] text-[#f0e6c0] border-2 border-[#c97b4a] hover:bg-[#a84a35] transition-colors disabled:opacity-50"
        >
          {props.isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      {/* 썸네일 — left grip 공간 만큼 살짝 이격 (ml-3). */}
      <div className="ml-3">
        <Thumbnail props={props} />
      </div>

      {/* 우측 상세 영역 */}
      <div className="flex-1 min-w-0">
        <CommittedFields
          description={props.description}
          tagsJson={props.tagsJson}
          onUpdate={props.onUpdate}
        />
      </div>
    </div>
  )
}

/** uploading / error 모드 — 정적 카드, 드래그 X. */
function StaticPhotoItem(props: PhotoItemUploadingProps | PhotoItemErrorProps) {
  return (
    <div
      className={`bg-[#f0e6c0] p-4 md:p-6 rounded-2xl shadow-sm border-2 transition-colors flex flex-col md:flex-row gap-6 relative ${
        props.mode === 'error' ? 'border-[#8b3a2a]' : 'border-[#8b7a52]/60'
      }`}
    >
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

      <Thumbnail props={props} />

      <div className="flex-1 min-w-0">
        <StatusText {...props} />
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
